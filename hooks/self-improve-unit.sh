#!/usr/bin/env bash
#
# self-improve-unit.sh: deterministic, model-free proof of the self-improve trigger's
# INCREMENTAL slicing + offset logic. This is the sibling of wall-unit.sh: it drives the
# trigger's real disk logic directly against a FAKE transcript, with the claude child spawn
# stubbed out (SELF_IMPROVE_NO_SPAWN=1), so it runs anywhere with no API call and never
# depends on a live model.
#
# The bug it guards against: the offset advance used to depend on the detached child
# remembering a buried Write step, so the offset never advanced and every fire re-sliced the
# WHOLE transcript from byte 0. The trigger now owns the offset and advances it the instant
# the slice is durably on disk. These checks prove that, in order:
#
#   1. FRESH        first fire slices [0..EOF]; mined-state records offset == EOF.
#   2. APPEND       after appending N bytes, the second fire's slice is EXACTLY those N bytes
#                   (byte length == N AND content == exactly what was appended), offset -> new EOF.
#                   This is THE check that proves "slices only new bytes".
#   3. NO-NEW-BYTES a third fire with no new bytes logs "skipped: no new bytes" and does nothing.
#   4. FAIL-OPEN    a fault path (garbage stdin) still exits 0 (PreCompact must never veto).
#
# Isolation: every run points HOME at a throwaway sandbox, so the trigger's ~/.orient/*
# (mined-state, slices, lock, log) all live under the sandbox and the real ~/.orient is
# never touched.
#
# Run:  bash hooks/self-improve-unit.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIGGER="$REPO/hooks/self-improve-trigger.mjs"

SANDBOX="$(mktemp -d -t self-improve-unit.XXXXXX)"
ORIENT="$SANDBOX/.orient"
STATE="$ORIENT/_mined-state.json"
TRANSCRIPT="$SANDBOX/fake-transcript.jsonl"
trap 'rm -rf "$SANDBOX"' EXIT

PASS=0; FAIL=0
ok()   { printf "  PASS  %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  FAIL  %s\n" "$1"; FAIL=$((FAIL+1)); }

# Fire the trigger once, as PreCompact does: pipe {transcript_path} on stdin, spawn stubbed.
# HOME points at the sandbox so all ~/.orient state redirects there.
fire() {
  printf '{"transcript_path":"%s"}' "$TRANSCRIPT" \
    | HOME="$SANDBOX" SELF_IMPROVE_NO_SPAWN=1 node "$TRIGGER"
  return $?
}

# Read the recorded offset for the fake transcript out of mined-state (or "MISSING").
read_offset() {
  node -e '
    const fs=require("fs");
    try {
      const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const v=s[process.argv[2]];
      process.stdout.write(v===undefined?"MISSING":String(v));
    } catch { process.stdout.write("MISSING"); }
  ' "$STATE" "$TRANSCRIPT"
}

# The single most-recent slice file's absolute path (newest by mtime), or "" if none.
newest_slice() {
  ls -t "$ORIENT"/_slice-*.jsonl 2>/dev/null | head -1
}

byte_len() { wc -c < "$1" | tr -d ' '; }

echo "=== 1. FRESH: first fire slices [0..EOF], offset -> EOF ==="
# A fake transcript with some initial content (multi-line, like a real jsonl).
printf '{"t":"line1"}\n{"t":"line2"}\n{"t":"line3"}\n' > "$TRANSCRIPT"
EOF1="$(byte_len "$TRANSCRIPT")"
fire >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "fire exits 0" || bad "fire exit $rc (want 0)"
OFF1="$(read_offset)"
[ "$OFF1" = "$EOF1" ] && ok "mined-state offset == EOF ($OFF1 == $EOF1)" \
                      || bad "mined-state offset $OFF1 != EOF $EOF1"
SLICE1="$(newest_slice)"
if [ -n "$SLICE1" ]; then
  SLEN1="$(byte_len "$SLICE1")"
  [ "$SLEN1" = "$EOF1" ] && ok "first slice length == whole transcript ($SLEN1)" \
                         || bad "first slice length $SLEN1 != EOF $EOF1"
  if cmp -s "$SLICE1" "$TRANSCRIPT"; then ok "first slice == whole transcript byte-for-byte"
  else bad "first slice content != whole transcript"; fi
else
  bad "no slice file written on first fire"
fi

echo ""
echo "=== 2. APPEND: second fire slices ONLY the appended bytes (byte-exact) ==="
# The exact bytes we append — the slice must equal THESE and nothing else.
APPEND='{"t":"NEW-line-4-only-this"}\n{"t":"NEW-line-5"}\n'
# Materialize the appended bytes to a reference file so we can compare byte-for-byte.
APPEND_REF="$SANDBOX/appended.bin"
printf "$APPEND" > "$APPEND_REF"
NAPPEND="$(byte_len "$APPEND_REF")"
# Append them to the transcript.
printf "$APPEND" >> "$TRANSCRIPT"
EOF2="$(byte_len "$TRANSCRIPT")"

# Sanity: the sandbox lock has a live cooldown from fire #1. To prove pure slicing in a unit
# (not the single-flight path, which has its own line), clear the lock before the real fire.
rm -f "$ORIENT/_self-improve.lock"

fire >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "fire exits 0" || bad "fire exit $rc (want 0)"
OFF2="$(read_offset)"
[ "$OFF2" = "$EOF2" ] && ok "offset advanced to new EOF ($OFF2 == $EOF2)" \
                      || bad "offset $OFF2 != new EOF $EOF2"
SLICE2="$(newest_slice)"
if [ -n "$SLICE2" ] && [ "$SLICE2" != "$SLICE1" ]; then
  SLEN2="$(byte_len "$SLICE2")"
  # THE proof: byte length == exactly the number of appended bytes.
  [ "$SLEN2" = "$NAPPEND" ] && ok "append slice length == appended bytes EXACTLY ($SLEN2 == $NAPPEND)" \
                            || bad "append slice length $SLEN2 != appended $NAPPEND"
  # THE proof, content: the slice is byte-for-byte exactly what we appended, nothing more.
  if cmp -s "$SLICE2" "$APPEND_REF"; then ok "append slice == appended bytes byte-for-byte"
  else bad "append slice content != appended bytes"; fi
  # And it must NOT contain any of the original content.
  if grep -q "line1" "$SLICE2"; then bad "append slice leaked original content (line1)"
  else ok "append slice contains none of the original bytes"; fi
else
  bad "no NEW slice file written on append fire (got: '$SLICE2', prev: '$SLICE1')"
fi

echo ""
echo "=== 3. NO NEW BYTES: fire does nothing and logs 'skipped: no new bytes' ==="
rm -f "$ORIENT/_self-improve.lock"
OFF_BEFORE="$(read_offset)"
SLICE_BEFORE="$(newest_slice)"
fire >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "fire exits 0" || bad "fire exit $rc (want 0)"
OFF_AFTER="$(read_offset)"
SLICE_AFTER="$(newest_slice)"
[ "$OFF_AFTER" = "$OFF_BEFORE" ] && ok "offset unchanged ($OFF_AFTER)" \
                                 || bad "offset changed $OFF_BEFORE -> $OFF_AFTER"
[ "$SLICE_AFTER" = "$SLICE_BEFORE" ] && ok "no new slice written" \
                                     || bad "a new slice appeared: $SLICE_AFTER"
if grep -q "skipped: no new bytes" "$ORIENT/self-improve.log" 2>/dev/null; then
  ok "log records 'skipped: no new bytes'"
else
  bad "log missing 'skipped: no new bytes'"
fi

echo ""
echo "=== 4. FAIL-OPEN: a fault path still exits 0 (PreCompact must never veto) ==="
# Garbage stdin (not JSON) -> parse fails -> no transcript -> must still exit 0.
printf 'not-json-at-all' | HOME="$SANDBOX" SELF_IMPROVE_NO_SPAWN=1 node "$TRIGGER" >/dev/null 2>&1
rc=$?
[ "$rc" = 0 ] && ok "garbage stdin exits 0" || bad "garbage stdin exit $rc (want 0)"
# A transcript path that does not exist -> transcriptSize null -> skip, exit 0.
printf '{"transcript_path":"%s/does-not-exist.jsonl"}' "$SANDBOX" \
  | HOME="$SANDBOX" SELF_IMPROVE_NO_SPAWN=1 node "$TRIGGER" >/dev/null 2>&1
rc=$?
[ "$rc" = 0 ] && ok "missing-transcript exits 0" || bad "missing-transcript exit $rc (want 0)"

echo ""
echo "------------------------------------------------------------"
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ] && { echo "  OVERALL: PASS"; exit 0; } || { echo "  OVERALL: FAIL"; exit 1; }
