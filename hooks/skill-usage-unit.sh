#!/usr/bin/env bash
#
# skill-usage-unit.sh: deterministic, model-free proof of the skill-usage hook. Feeds it the
# exact stdin shape Claude Code sends a PreToolUse hook (tool_name + tool_input.skill) and
# asserts the on-disk ~/.orient/skill-usage.json, with no API call, so it runs anywhere. This
# is the sibling of wall-unit.sh and self-improve-unit.sh.
#
# The checks, in order:
#   1. COUNTS       two calls to the same skill -> use_count == 2, timestamps written.
#   2. FIRST STAMP  first_used_at is set once and does NOT move; last_used_at does.
#   3. FAIL-OPEN    malformed stdin exits 0 AND leaves the existing file uncorrupted.
#   4. NON-SKILL    a non-Skill tool_name exits 0 and writes nothing.
#   5. NO NAME      a Skill call with no skill name exits 0 and writes nothing.
#
# Isolation: HOME points at a throwaway sandbox, so ~/.orient/skill-usage.json lives under the
# sandbox and the real ~/.orient is never touched.
#
# Run:  bash hooks/skill-usage-unit.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$REPO/hooks/skill-usage.mjs"

SANDBOX="$(mktemp -d -t skill-usage-unit.XXXXXX)"
ORIENT="$SANDBOX/.orient"
USAGE="$ORIENT/skill-usage.json"
trap 'rm -rf "$SANDBOX"' EXIT

PASS=0; FAIL=0
ok()  { printf "  PASS  %s\n" "$1"; PASS=$((PASS+1)); }
bad() { printf "  FAIL  %s\n" "$1"; FAIL=$((FAIL+1)); }

# Fire the hook once with the given raw stdin. HOME redirects ~/.orient into the sandbox.
fire() { printf '%s' "$1" | HOME="$SANDBOX" node "$HOOK"; return $?; }

# Read a JSON field out of skill-usage.json for a given skill, or "MISSING".
field() {
  node -e '
    const fs=require("fs");
    try {
      const u=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const rec=u[process.argv[2]];
      const v=rec?rec[process.argv[3]]:undefined;
      process.stdout.write(v===undefined?"MISSING":String(v));
    } catch { process.stdout.write("MISSING"); }
  ' "$USAGE" "$1" "$2"
}

echo "=== 1. COUNTS: two calls to the same skill -> use_count == 2 ==="
fire '{"tool_name":"Skill","tool_input":{"skill":"build"}}' >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "first call exits 0" || bad "first call exit $rc (want 0)"
fire '{"tool_name":"Skill","tool_input":{"skill":"build"}}' >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "second call exits 0" || bad "second call exit $rc (want 0)"
CNT="$(field build use_count)"
[ "$CNT" = "2" ] && ok "use_count == 2 across two calls" || bad "use_count $CNT (want 2)"

echo ""
echo "=== 2. STAMPS: first_used_at set once and frozen, last_used_at written ==="
FIRST="$(field build first_used_at)"
LAST="$(field build last_used_at)"
[ "$FIRST" != "MISSING" ] && ok "first_used_at written ($FIRST)" || bad "first_used_at missing"
[ "$LAST" != "MISSING" ] && ok "last_used_at written ($LAST)" || bad "last_used_at missing"
# A third call must keep first_used_at identical.
fire '{"tool_name":"Skill","tool_input":{"skill":"build"}}' >/dev/null 2>&1
FIRST2="$(field build first_used_at)"
[ "$FIRST2" = "$FIRST" ] && ok "first_used_at frozen across calls" || bad "first_used_at moved $FIRST -> $FIRST2"

echo ""
echo "=== 3. FAIL-OPEN: malformed stdin exits 0 and does NOT corrupt the file ==="
BEFORE="$(cat "$USAGE")"
fire 'not-json-at-all' >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "malformed stdin exits 0" || bad "malformed stdin exit $rc (want 0)"
AFTER="$(cat "$USAGE")"
[ "$AFTER" = "$BEFORE" ] && ok "existing file left uncorrupted" || bad "file changed on malformed input"
# The file must still parse as JSON.
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$USAGE" 2>/dev/null \
  && ok "file still valid JSON" || bad "file no longer valid JSON"

echo ""
echo "=== 4. NON-SKILL tool is ignored gracefully ==="
CNT_BEFORE="$(field build use_count)"
fire '{"tool_name":"Read","tool_input":{"file_path":"/tmp/x"}}' >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "non-Skill tool exits 0" || bad "non-Skill tool exit $rc (want 0)"
CNT_AFTER="$(field build use_count)"
[ "$CNT_AFTER" = "$CNT_BEFORE" ] && ok "non-Skill call wrote nothing (count unchanged)" \
                                 || bad "non-Skill call changed state $CNT_BEFORE -> $CNT_AFTER"

echo ""
echo "=== 5. NO SKILL NAME: a Skill call with no name is ignored ==="
fire '{"tool_name":"Skill","tool_input":{}}' >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "no-name Skill call exits 0" || bad "no-name Skill call exit $rc (want 0)"
CNT_NN="$(field build use_count)"
[ "$CNT_NN" = "$CNT_BEFORE" ] && ok "no-name call wrote nothing (count unchanged)" \
                             || bad "no-name call changed state $CNT_BEFORE -> $CNT_NN"

echo ""
echo "------------------------------------------------------------"
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ] && { echo "  OVERALL: PASS"; exit 0; } || { echo "  OVERALL: FAIL"; exit 1; }
