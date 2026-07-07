#!/usr/bin/env node
/*
 * core-wall.mjs: the wall that keeps the self-improving agent off the core.
 *
 * Wired as a PreToolUse hook (matcher "Edit|Write|MultiEdit") into the headless
 * self-improve child via a generated --settings file (see self-improve-trigger.mjs).
 * On every file-mutating tool call it resolves the target path and, if it lands on a
 * CORE file, blocks the call by exiting 2. The agent is free to sharpen everything
 * else (the write-* / *-brain skills, the brain vault); only the core is sealed.
 *
 * WHY a hook, not permissions.deny: under --permission-mode bypassPermissions (which
 * the headless run needs so it never hangs on a prompt) deny rules are skipped, but a
 * PreToolUse hook still fires and an exit-2 block still holds. Proven empirically, not
 * assumed: hooks/wall-proof.sh spawns a real child and shows the block on disk.
 *
 * PORTABILITY: the core set is computed from THIS file's own location (import.meta.url),
 * so it ships wherever the repo is cloned, no hardcoded user paths. The one path outside
 * the repo, the global ~/.claude/CLAUDE.md, is derived from homedir().
 *
 * COVERAGE via realpath: every core target is resolved with realpathSync, and so is the
 * edit's file_path. Because ~/.claude/agents/*.md and ~/.claude/skills/* are symlinks
 * into this repo, an edit arriving via either the real path or the ~/.claude alias
 * resolves to the SAME real path and is caught by one rule. (~/.claude/CLAUDE.md is a
 * real file, not a link, so it is listed explicitly.)
 *
 * FAIL-CLOSED on the decision, fail-open on faults: a clean "not core" lets the call
 * through (exit 0); a matched core path blocks (exit 2); a parse/IO fault that leaves
 * the target ambiguous also blocks (exit 2), because a wall that fails open is no wall.
 */
import { realpathSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../Orient/hooks
const REPO = resolve(HERE, ".."); // .../Orient

// The core: the files the self-improving agent must NEVER edit. Paths are
// relative to the repo root; resolved to realpaths below so symlinked aliases collapse
// onto these same entries. To wall a new core file, add its repo-relative path here.
const CORE_RELATIVE = [
  "skills/orient", // the orient skill (whole dir)
  "agents/execute.md", // the Execute agent's system prompt (old skills/execute retired)
  "agents/critique.md", // the Critique agent's system prompt (live)
  "agents/self-improve.md", // the agent's own system prompt: it must not rewrite its own guardrails
  "core/orient-overview.md", // the role
  "hooks/core-wall.mjs", // the wall itself: it must not edit away its own bars
];

// The one core file outside the repo: the global instructions, a real file (not a link).
const CORE_ABSOLUTE = [join(homedir(), ".claude", "CLAUDE.md")];

// Resolve every core entry to its realpath once. Missing entries are skipped (a path
// that does not exist cannot be the target of an edit on disk).
function realOrNull(p) {
  try { return realpathSync(p); } catch { return null; }
}

const CORE_REAL = [
  ...CORE_RELATIVE.map((r) => realOrNull(join(REPO, r))),
  ...CORE_ABSOLUTE.map(realOrNull),
].filter(Boolean);

// Is `target` the same file as `core`, or inside it (for the skill dirs)?
function isUnder(target, core) {
  return target === core || target.startsWith(core + "/");
}

// Resolve the edit target to a realpath. For a NEW file the leaf may not exist yet,
// so realpath the deepest existing ancestor and re-append the tail; this still lands
// the result inside a walled directory (e.g. a new file under skills/orient/).
function resolveTarget(raw) {
  if (!raw) return null;
  let abs = resolve(raw);
  const tail = [];
  // walk up to the first ancestor that exists, then realpath it
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const real = realOrNull(abs);
    if (real) return tail.length ? join(real, ...tail.reverse()) : real;
    const parent = dirname(abs);
    if (parent === abs) return resolve(raw); // hit the root, nothing resolved
    tail.push(abs.slice(parent.length + 1));
    abs = parent;
  }
}

function block(reason) {
  process.stderr.write(reason + "\n");
  process.exit(2); // exit 2: PreToolUse block, holds even under bypassPermissions
}

function readStdin() {
  return new Promise((res) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(d));
  });
}

async function main() {
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || "{}");
  } catch {
    // Could not read the call: cannot prove it is safe -> fail closed.
    block("Core wall: unreadable tool input; blocking to be safe.");
    return;
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath) process.exit(0); // no file target (e.g. not a real Edit/Write): allow

  const target = resolveTarget(filePath);
  if (!target) process.exit(0);

  for (const core of CORE_REAL) {
    if (isUnder(target, core)) {
      block(
        "Core wall: " + filePath + " is a CORE file (" + core + "). " +
          "The self-improving agent may sharpen the write-* skills and the brain, but never the core " +
          "(orient, execute, critique, its own prompt, the role, the global CLAUDE.md, or this wall)."
      );
    }
  }

  process.exit(0); // not core: allow
}

main();
