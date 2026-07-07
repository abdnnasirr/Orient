#!/usr/bin/env bash
#
# wall-unit.sh: deterministic, model-free proof of the core wall's decision logic.
# Feeds the hook the exact stdin shape Claude Code sends a PreToolUse hook (tool_name +
# tool_input.file_path) and asserts the exit code: 2 = block, 0 = allow. This proves the
# wall's verdicts directly, with no API call, so it runs anywhere. The live model-in-the-
# loop leg (an actual spawned `claude -p` reaching a tool call) is in wall-proof.sh.
#
# Run:  bash hooks/wall-unit.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$REPO/hooks/core-wall.mjs"
HOME_DIR="$HOME"
PASS=0; FAIL=0

# check NAME EXPECTED_EXIT FILE_PATH [TOOL]
check() {
  local name="$1" want="$2" fp="$3" tool="${4:-Edit}"
  printf '{"tool_name":"%s","tool_input":{"file_path":"%s"}}' "$tool" "$fp" | node "$HOOK" >/dev/null 2>&1
  local got=$?
  if [ "$got" = "$want" ]; then
    printf "  PASS  exit %s  %-46s %s\n" "$got" "$name" "$fp"; PASS=$((PASS+1))
  else
    printf "  FAIL  exit %s (want %s)  %-40s %s\n" "$got" "$want" "$name" "$fp"; FAIL=$((FAIL+1))
  fi
}

echo "=== CORE files must BLOCK (exit 2) ==="
check "orient skill (real)"        2 "$REPO/skills/orient/SKILL.md"
check "orient skill (~/.claude)"   2 "$HOME_DIR/.claude/skills/orient/SKILL.md"
check "execute agent (real)"       2 "$REPO/agents/execute.md"
check "execute (~/.claude/agents)" 2 "$HOME_DIR/.claude/agents/execute.md"
check "critique agent (real)"      2 "$REPO/agents/critique.md"
check "critique (~/.claude/agents)" 2 "$HOME_DIR/.claude/agents/critique.md"
check "self-improve prompt (real)" 2 "$REPO/agents/self-improve.md"
check "self-improve (~/.claude)"   2 "$HOME_DIR/.claude/agents/self-improve.md"
check "orient-overview role"       2 "$REPO/core/orient-overview.md"
check "global CLAUDE.md"           2 "$HOME_DIR/.claude/CLAUDE.md"
check "the wall itself"            2 "$REPO/hooks/core-wall.mjs"
check "NEW file inside a core dir" 2 "$REPO/skills/orient/_new.md" "Write"

echo ""
echo "=== EDITABLE files must ALLOW (exit 0): the agent IS meant to improve these ==="
check "write-prompts skill"        0 "$REPO/skills/write-prompts/SKILL.md"
check "test-prompts skill"         0 "$REPO/skills/test-prompts/SKILL.md"
check "write-brain skill"          0 "$REPO/skills/write-brain/SKILL.md"
check "clean-brain skill"          0 "$REPO/skills/clean-brain/SKILL.md"
check "scratch under write-prompts" 0 "$REPO/skills/write-prompts/_walltest_DELETE_ME.md" "Write"
check "the brain vault"            0 "$HOME_DIR/Obsidian/a-note.md" "Write"

echo ""
echo "=== safety edges ==="
printf 'not json' | node "$HOOK" >/dev/null 2>&1; [ $? = 2 ] \
  && { echo "  PASS  exit 2  malformed input fails CLOSED"; PASS=$((PASS+1)); } \
  || { echo "  FAIL  malformed input did not fail closed"; FAIL=$((FAIL+1)); }
printf '{"tool_name":"Read","tool_input":{}}' | node "$HOOK" >/dev/null 2>&1; [ $? = 0 ] \
  && { echo "  PASS  exit 0  no file_path allowed"; PASS=$((PASS+1)); } \
  || { echo "  FAIL  no file_path not allowed"; FAIL=$((FAIL+1)); }

echo ""
echo "------------------------------------------------------------"
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ] && { echo "  OVERALL: PASS"; exit 0; } || { echo "  OVERALL: FAIL"; exit 1; }
