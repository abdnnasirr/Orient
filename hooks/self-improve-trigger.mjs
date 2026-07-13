#!/usr/bin/env node
/*
 * self-improve-trigger.mjs: fires the self-improving agent ONCE PER COMPACTION.
 *
 * On PreCompact, spawns a detached, headless Claude Code run AS the `self-improve`
 * agent:
 *   claude --agent self-improve --dangerously-skip-permissions -p "<task>"
 * so the system improves itself as a session compacts, with no human in the loop.
 *   - mine-a-session: mines ONLY the NEW slice of the transcript since it last ran.
 *   - clean-the-brain: at most once a week (stamped), only if a brain is configured.
 *
 * WHY COMPACTION-ONLY + INCREMENTAL: the old hook also fired on SessionEnd and re-mined
 * the WHOLE transcript each time, so parallel boundary bursts spawned duplicate runs that
 * hit "transcript not found (live session)" and wastefully re-mined everything (148 runs
 * in 2 days). This version:
 *   1. COMPACTION ONLY  — wired on PreCompact alone (SessionEnd removed from settings).
 *   2. SINGLE-FLIGHT    — a short-cooldown lock (~_self-improve.lock) kills parallel bursts.
 *   3. INCREMENTAL      — reads the transcript FROM DISK here (it exists even when the
 *                         spawned child cannot resolve it), tracks a per-transcript byte
 *                         offset in ~/.orient/_mined-state.json, and slices ONLY the new
 *                         bytes into a temp file it hands the child. No new bytes -> SKIP.
 *   4. TRIGGER-OWNED OFFSET — the TRIGGER advances the offset the instant the slice file is
 *                         durably on disk (fsync'd), BEFORE spawning the child. The old
 *                         design made the offset advance depend on the detached child
 *                         remembering a Write step buried at the end of a large prompt, on a
 *                         clean finish only — the model skipped it, so the offset never
 *                         advanced and every fire re-sliced the whole transcript from byte 0.
 *                         Now there is ONE owner of the offset (this trigger), so the next
 *                         fire always slices only new bytes regardless of what the child does.
 *                         TRADEOFF (missed-run safety): the sliced-out bytes are preserved in
 *                         the durable _slice-*.jsonl file (kept, not deleted, until aged out),
 *                         so a crashed child's work is recoverable from that slice. We do NOT
 *                         re-queue the slice automatically — that would re-introduce a second
 *                         owner and the same unreliability. Coverage-of-bytes is guaranteed by
 *                         the persisted slice; mining-of-a-crashed-slice is best-effort. This
 *                         is the deliberate simple choice: requirement 1 (incremental MUST
 *                         work) over an unreliable auto-recovery. See CLEANUP below for how
 *                         slices are aged out so they do not accumulate.
 *   5. SLICE CLEANUP    — at each fire, old _slice-*.jsonl files beyond the most recent
 *                         SLICE_KEEP are deleted, so slices (incl. any giant legacy full-
 *                         transcript slice) never accumulate on disk.
 *
 * Config (model-agnostic): ~/.orient/config.json -> { "brain": "<vault path>" }. A plain
 * file any runner can read. No brain configured -> the brain work is skipped (config-gated).
 *
 * Recursion guard: the spawned run inherits CLAUDE_SELF_IMPROVE_CHILD=1, and this hook
 * no-ops when that is set, so a self-improve run never spawns another. (We do NOT use
 * --bare, which would also disable the Skill tool the agent needs.)
 *
 * FAIL-OPEN, ALWAYS: any fault exits 0. PreCompact must NEVER exit non-zero (it would veto
 * the compaction). Detached + unref + stdio ignore, so the session never waits on it.
 *
 * --dry: print what it would spawn/skip; spawn nothing, write no lock, stamp nothing,
 *        advance no offset, write no slice.
 *
 * SELF_IMPROVE_NO_SPAWN=1 (env): the deterministic test seam. Runs the REAL slicing +
 *        offset + lock + cleanup logic against the real transcript on disk, but stubs out
 *        the actual `spawn` of the claude child (logs "WOULD SPAWN (no-spawn)" instead).
 *        Unlike --dry it DOES write the slice and advance the offset, so the unit harness
 *        (hooks/self-improve-unit.sh) can assert the on-disk result byte-for-byte without
 *        ever depending on a live model. Used only by tests; never set in production wiring.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
  statSync,
  openSync,
  readSync,
  writeSync,
  fsyncSync,
  closeSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DRY = process.argv.includes("--dry");
// The deterministic test seam: run all real disk logic (slice + advance offset + lock +
// cleanup) but skip the actual spawn of the claude child. See the header. Tests only.
const NO_SPAWN = process.env.SELF_IMPROVE_NO_SPAWN === "1";
const HOME = homedir();
const HOOKS_DIR = dirname(fileURLToPath(import.meta.url)); // this hook's own dir, so paths ship
const ORIENT_DIR = join(HOME, ".orient");
const CONFIG = join(ORIENT_DIR, "config.json");
const CLEAN_STAMP = join(ORIENT_DIR, "_clean-last.json");
const SKILLS_CLEAN_STAMP = join(ORIENT_DIR, "_clean-skills-last.json");
const LOG = join(ORIENT_DIR, "self-improve.log");
const LOCK = join(ORIENT_DIR, "_self-improve.lock");
const MINED_STATE = join(ORIENT_DIR, "_mined-state.json");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Slice files are the durable record of what was handed to each child (see TRADEOFF above).
// Keep the most recent few for crash-recovery; delete older ones so they never accumulate.
const SLICE_PREFIX = "_slice-";
const SLICE_KEEP = 3;

// Single-flight: a fire within COOLDOWN of a live lock is a duplicate burst -> skip.
// A lock older than STALE is a crashed run -> override it and proceed.
const LOCK_COOLDOWN_MS = 120 * 1000; // ~120s: collapses the parallel-boundary burst
const LOCK_STALE_MS = 10 * 60 * 1000; // ~10min: a lock this old means the run died

// The core wall: a PreToolUse hook that blocks edits to core files. We pass it
// to the child via a generated --settings file. Under bypassPermissions, permissions.deny
// is skipped but a PreToolUse exit-2 block still holds (proven by hooks/wall-proof.sh),
// so the wall is a hook, not a deny rule. Computed from this file's location -> portable.
const WALL_HOOK = join(HOOKS_DIR, "core-wall.mjs");
const WALL_SETTINGS = join(ORIENT_DIR, "_wall-settings.json");

// The Claude adapter installer. Run in --apply mode once per fire, BEFORE spawning the
// child, so a skill drafted on a PRIOR run auto-activates (symlinked into ~/.claude/skills)
// this fire and is loadable by the child and by future sessions. Path is computed from this
// hook's own location, so it ships with the repo. The installer is glob-discovery: it links
// every skills/<name>/ that has a SKILL.md and skips real dirs — see adapters/claude/install.mjs.
const INSTALLER = join(HOOKS_DIR, "..", "adapters/claude/install.mjs");

// Run the installer in --apply mode, TOTALLY fail-open: any error (installer throws, node
// missing, installer file absent) is swallowed and logged — it must NEVER make this hook exit
// non-zero (PreCompact must never veto a compaction). --dry is inert here (report only). We
// use spawnSync so it completes before we spawn the child, and cap it so a hung installer can
// never wedge the teardown. Uses the SAME node that runs this hook (process.execPath), and can
// be pointed at an alternate installer via SELF_IMPROVE_INSTALLER (test seam only).
function runInstaller() {
  if (DRY) { appendLog("would run installer (--dry: skipped)"); return; }
  try {
    const installer = process.env.SELF_IMPROVE_INSTALLER || INSTALLER;
    const r = spawnSync(process.execPath, [installer, "--apply"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30 * 1000,
      encoding: "utf8",
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error("installer exit " + r.status + ": " + (r.stderr || "").trim());
    appendLog("installer applied ok" + (r.stdout ? " (" + r.stdout.trim().split("\n").pop() + ")" : ""));
  } catch (e) {
    // FAIL-OPEN: never rethrow. A broken installer must not stop a self-improve fire or the
    // compaction. The skill just fails to activate this fire; the next fire retries.
    appendLog("installer failed (swallowed, fail-open): " + (e && e.message ? e.message : String(e)));
  }
}

// Write the child settings file that wires the wall, and return its path. Generated at
// runtime from the resolved wall-hook path, so nothing brittle is baked in for shipping.
function writeWallSettings() {
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write|MultiEdit",
          hooks: [{ type: "command", command: "node " + JSON.stringify(WALL_HOOK).slice(1, -1) }],
        },
      ],
    },
  };
  mkdirSync(ORIENT_DIR, { recursive: true });
  writeFileSync(WALL_SETTINGS, JSON.stringify(settings, null, 2));
  return WALL_SETTINGS;
}

function pass() { process.exit(0); }

// A self-improve run must never trigger another.
if (process.env.CLAUDE_SELF_IMPROVE_CHILD === "1") pass();

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", () => resolve(d));
  });
}

function brainPath() {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")).brain || ""; } catch { return ""; }
}

// A long-lived headless token from `claude setup-token`, stored in config.json as
// "oauthToken". It lets the detached child authenticate on its own, since it cannot reuse
// the live session's in-memory OAuth. Optional: with no token the child falls back to
// ambient auth (which 401s when spawned from inside a session — see the run-log).
function oauthToken() {
  try { return JSON.parse(readFileSync(CONFIG, "utf8")).oauthToken || ""; } catch { return ""; }
}

// The child's environment. The live session authenticates via an OAuth token the host
// refreshes in-memory, which a detached child cannot reuse. So strip the parent's managed
// auth (base URL + keys) and, if configured, hand the child its own headless token.
function childEnv() {
  const e = { ...process.env, CLAUDE_SELF_IMPROVE_CHILD: "1" };
  delete e.ANTHROPIC_BASE_URL;
  delete e.ANTHROPIC_API_KEY;
  delete e.ANTHROPIC_AUTH_TOKEN;
  const tok = oauthToken();
  if (tok) e.CLAUDE_CODE_OAUTH_TOKEN = tok;
  return e;
}

// Weekly cadence, shared mechanism: each pass keeps its own stamp file so the brain clean and
// the skills clean run on independent weekly clocks and never consume each other's turn.
function cleanDue(stamp) {
  try {
    const { at } = JSON.parse(readFileSync(stamp, "utf8"));
    return Date.now() - new Date(at).getTime() >= WEEK_MS;
  } catch { return true; } // never cleaned, or unreadable stamp: due
}

function stampClean(stamp) {
  try {
    mkdirSync(ORIENT_DIR, { recursive: true });
    writeFileSync(stamp, JSON.stringify({ at: new Date().toISOString() }));
  } catch {}
}

// Observability: a visible trace so the user can SEE the self-improver fire, even though the
// run itself is detached and silent. The trigger logs that it FIRED; the agent appends what
// it CHANGED at the end of its run. A FIRED line with no change-line after it means the
// spawned child never authenticated (the known headless-auth failure mode), not a wall fault.
// SKIP lines record a burst collapsed by the lock or a no-new-bytes short-circuit.
function appendLog(line) {
  try {
    mkdirSync(ORIENT_DIR, { recursive: true });
    appendFileSync(LOG, "[" + new Date().toISOString() + "] " + line + "\n");
  } catch {}
}

// --- Incremental state: per-transcript byte offset already mined. -----------------------
// { "<transcriptPath>": <lastByteOffset> }. The TRIGGER owns this file — it both reads it
// (to know where the last slice ended) and writes it (to advance past the slice it just
// handed off). One owner, so the offset advance can never be skipped by a forgetful child.
function readMinedOffset(transcript) {
  try {
    const state = JSON.parse(readFileSync(MINED_STATE, "utf8"));
    const v = state[transcript];
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch { return 0; } // no state / unreadable: start from the top (fail toward coverage)
}

// Advance the mined offset for this transcript to `offset`, preserving every other key.
// Called by the trigger the instant the slice file is durably on disk, BEFORE spawning the
// child — so the next fire slices only new bytes no matter what the child does. Returns true
// on success. Fail-open: a write error is logged and swallowed; it must never wedge the
// compaction. (If this write fails, the next fire simply re-slices the same range — safe.)
function writeMinedOffset(transcript, offset) {
  try {
    mkdirSync(ORIENT_DIR, { recursive: true });
    let state = {};
    try { state = JSON.parse(readFileSync(MINED_STATE, "utf8")) || {}; } catch {}
    state[transcript] = offset;
    // Durable write: fsync so the advanced offset survives a crash right after we spawn.
    const fd = openSync(MINED_STATE, "w");
    try {
      writeSync(fd, JSON.stringify(state, null, 2));
      try { fsyncSync(fd); } catch {}
    } finally { closeSync(fd); }
    return true;
  } catch { return false; }
}

// Delete _slice-*.jsonl files beyond the most recent SLICE_KEEP, so slices (including any
// giant legacy full-transcript slice) never accumulate. Best-effort and fail-open. Called
// at each fire, AFTER the new slice is written so it is among the kept ones.
function cleanupSlices() {
  try {
    const files = readdirSync(ORIENT_DIR)
      .filter((n) => n.startsWith(SLICE_PREFIX) && n.endsWith(".jsonl"))
      .map((n) => {
        const p = join(ORIENT_DIR, n);
        let mtime = 0;
        try { mtime = statSync(p).mtimeMs; } catch {}
        return { p, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first
    for (const f of files.slice(SLICE_KEEP)) {
      try { unlinkSync(f.p); } catch {}
    }
  } catch {} // fail-open: a cleanup error must never wedge the compaction
}

// The transcript's current size on disk, or null if it is missing/unreadable. We read the
// file FROM DISK here (the trigger's cwd sees it) even when the spawned child cannot resolve
// the path — which is the exact "transcript not found (live session)" waste this fixes.
function transcriptSize(transcript) {
  try {
    const st = statSync(transcript);
    return st.isFile() ? st.size : null;
  } catch { return null; }
}

// Slice bytes [start, end) of the transcript into a temp file and return its path, or null
// on any error (caller then falls open: mine the full path as a last resort). We stream in
// bounded chunks so a large transcript never balloons memory, and fsync the result so the
// slice is durably on disk BEFORE the trigger advances the offset — the whole point of
// trigger-owned offsets is that "handed off" means "byte-for-byte persisted", not "spawned".
function writeSlice(transcript, start, end, tsTag) {
  const out = join(ORIENT_DIR, SLICE_PREFIX + tsTag + ".jsonl");
  let fdIn = null;
  let fdOut = null;
  try {
    mkdirSync(ORIENT_DIR, { recursive: true });
    fdIn = openSync(transcript, "r");
    fdOut = openSync(out, "w"); // truncate/create the slice file
    const CHUNK = 1 << 20; // 1 MiB
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = start;
    while (pos < end) {
      const want = Math.min(CHUNK, end - pos);
      const got = readSync(fdIn, buf, 0, want, pos);
      if (got <= 0) break;
      writeSync(fdOut, buf, 0, got);
      pos += got;
    }
    try { fsyncSync(fdOut); } catch {} // durable before we advance the offset
    return out;
  } catch {
    return null;
  } finally {
    if (fdIn !== null) { try { closeSync(fdIn); } catch {} }
    if (fdOut !== null) { try { closeSync(fdOut); } catch {} }
  }
}

// --- Single-flight lock. -----------------------------------------------------------------
// Returns "skip" if a live lock (younger than cooldown) means this is a duplicate burst.
// Returns "proceed" if there is no lock, the lock is stale (crashed run -> override), or any
// lock error occurs (fail-open toward doing the work). On "proceed" we (re)write the lock.
function acquireLock() {
  if (DRY) return "proceed";
  try {
    const st = statSync(LOCK);
    const age = Date.now() - st.mtimeMs;
    if (age < LOCK_COOLDOWN_MS) return "skip"; // live lock: duplicate burst
    // else: older than cooldown. If also older than STALE it is a crashed run; either way
    // (cooldown passed) this is a legitimate fresh fire, so take the lock and proceed.
  } catch {
    // no lock (or unreadable): proceed and create it.
  }
  try {
    mkdirSync(ORIENT_DIR, { recursive: true });
    writeFileSync(LOCK, JSON.stringify({ at: new Date().toISOString() }));
  } catch {} // fail-open: a lock-write error must never wedge the compaction
  return "proceed";
}

// Tools are bounded on purpose: the agent reads/writes files and loads skills, but
// never runs arbitrary shell. So even with prompts skipped (required for a detached
// run), the blast radius is files + skills + brain, not the whole machine.
const ALLOWED_TOOLS = "Read,Edit,Write,Glob,Grep,Skill";

// The miner runs on Sonnet, not Opus. Tested head-to-head on a real transcript slice:
// Sonnet matched Opus on both content coverage AND voice once the "write the brain in
// first person" instruction was in place, for ~40% less cost and far lighter on the
// rolling usage window. Flip to "claude-opus-4-8" if max brain quality ever beats cost.
const MODEL = "claude-sonnet-5";

function claudeArgs(promptText, wallSettings) {
  return ["--agent", "self-improve", "--model", MODEL, "--permission-mode", "bypassPermissions", "--settings", wallSettings, "--allowedTools", ALLOWED_TOOLS, "-p", promptText];
}

function fire(promptText) {
  // Generate the wall settings fresh each spawn so the wired hook path is always current.
  let wallSettings;
  try { wallSettings = writeWallSettings(); } catch { wallSettings = WALL_SETTINGS; }
  if (DRY) {
    process.stdout.write("WOULD SPAWN: claude " + claudeArgs(promptText, wallSettings).map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ") + "\n");
    return;
  }
  if (NO_SPAWN) {
    // Test seam: everything real EXCEPT the model spawn. Prove slicing/offset without a model.
    appendLog("WOULD SPAWN (no-spawn): claude " + claudeArgs(promptText, wallSettings).map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" "));
    return;
  }
  try {
    spawn("claude", claudeArgs(promptText, wallSettings), {
      detached: true,
      stdio: "ignore",
      env: childEnv(),
    }).unref();
  } catch {} // fail-open: a failed spawn never wedges a teardown
}

async function main() {
  try {
    // Activate any skill drafted on a prior fire BEFORE we spawn the child. Fully fail-open
    // (see runInstaller): it can never make this hook exit non-zero. Runs every real fire, so
    // creation reliably reaches the toolbox no matter which prior run wrote the skill.
    runInstaller();

    const raw = DRY ? "" : await readStdin();
    let payload = {};
    try { payload = JSON.parse(raw || "{}"); } catch {}
    const transcript = payload.transcript_path || (DRY ? "<transcript-path>" : "");
    const brain = brainPath();

    if (transcript) {
      // 3 + 4: INCREMENTAL, from disk. Skip a fire that has no new bytes to mine — this is
      // the fix for the "transcript not found (live session)" re-mine-everything waste.
      const size = DRY ? null : transcriptSize(transcript);
      const lastOffset = DRY ? 0 : readMinedOffset(transcript);

      if (!DRY && size === null) {
        appendLog("skipped: transcript missing/unreadable (" + transcript + ")");
      } else if (!DRY && size <= lastOffset) {
        appendLog("skipped: no new bytes since offset " + lastOffset + " (" + transcript + ")");
      } else {
        // 2: SINGLE-FLIGHT. Only reached when there IS real new work, so a no-op fire never
        // consumes the lock and never blocks a subsequent real fire during the cooldown.
        if (acquireLock() === "skip") {
          appendLog("skipped: single-flight (lock live, cooldown " + LOCK_COOLDOWN_MS / 1000 + "s)");
        } else {
          const tsTag = Date.now().toString();
          // Slice [lastOffset, EOF) to a durable (fsync'd) file; the child mines THAT and
          // always finds it. --dry writes nothing; NO_SPAWN writes the real slice.
          const slicePath = DRY ? null : writeSlice(transcript, lastOffset, size, tsTag);

          // TRIGGER-OWNED OFFSET: the slice is now durably on disk, so advance the offset to
          // EOF *here*, before we spawn. This is the fix — the offset no longer depends on a
          // forgetful child, so the next fire slices only new bytes. Only advance if the slice
          // actually wrote; if it failed we hand the child the full path (below) and leave the
          // offset alone so the next fire re-covers this range (coverage over token-savings).
          if (!DRY && slicePath) {
            writeMinedOffset(transcript, size);
            cleanupSlices(); // age out old slices now that the new one is on disk
          }

          // Fail-open: if the slice write failed, hand the child the full transcript path
          // instead of skipping — coverage beats a lost session.
          const childTranscript = slicePath || transcript;

          if (!DRY) {
            appendLog(
              "FIRED mine-a-session (slice bytes " + lastOffset + ".." + size +
              (slicePath ? " -> " + slicePath + "; offset advanced to " + size : " [slice failed; full path fallback, offset unchanged]") + ")"
            );
          }
          fire(
            "Run in mine-a-session mode. The transcript slice to mine is at " + childTranscript + " " +
            "(this is only the NEW part of the session since the last run — read the whole slice). " +
            (brain ? "The brain vault is at " + brain + ". " : "No brain is configured; skip the brain bucket. ") +
            "When you finish, append one dated line to your run-log at " + LOG + " saying what you changed, or 'nothing to change'."
          );
        }
      }
    }

    if (brain && cleanDue(CLEAN_STAMP)) {
      if (!DRY) appendLog("FIRED clean-the-brain");
      fire(
        "Run in clean-the-brain mode. The brain vault is at " + brain + ". " +
        "When you finish, append one dated line to your run-log at " + LOG + " saying what you changed, or 'nothing to change'."
      );
      if (!DRY) stampClean(CLEAN_STAMP);
    }

    // The weekly skill-library health pass. Needs no brain configured; same weekly stamp mechanism, its own clock.
    if (cleanDue(SKILLS_CLEAN_STAMP)) {
      if (!DRY) appendLog("FIRED clean-skills");
      fire(
        "Run in clean-skills mode. The usage log is at " + join(ORIENT_DIR, "skill-usage.json") + ". " +
        "When you finish, append one dated line to your run-log at " + LOG + " saying what you flagged, or 'nothing to change'."
      );
      if (!DRY) stampClean(SKILLS_CLEAN_STAMP);
    }
  } catch {}
  process.exit(0);
}
main();
