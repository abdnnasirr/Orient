#!/usr/bin/env node
/*
 * install.mjs: symlink this repo's agents + skills into ~/.claude so Claude Code loads them.
 *
 * SKILLS ARE GLOB-DISCOVERED, not a hardcoded list: every directory under skills/ that
 * contains a SKILL.md is linked to ~/.claude/skills/<name>. This is the load-bearing fix
 * for the self-improver — a skill it drafts into skills/<new>/SKILL.md is auto-discovered
 * on the next install run and becomes loadable, instead of dying in the repo because it was
 * never added to a manual list. Agents stay an explicit list (there are only three, and the
 * wall walls them by exact path).
 *
 * SAFETY — never clobber a real dir: install refuses to replace anything at the target that
 * is NOT already a symlink. So a real-directory skill someone installed by hand under
 * ~/.claude/skills (e.g. redesign-skill, brandkit) is SKIPPED and left untouched; only a
 * missing target or an existing symlink is (re)linked. Idempotent: re-linking an existing
 * symlink to the same target is a no-op in effect.
 *
 * Dry-run is the DEFAULT (prints what it WOULD do, changes nothing). Pass --apply to act.
 * Output is grouped so a caller can see exactly what gets linked vs skipped vs already-ok.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const APPLY = process.argv.includes("--apply");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../.."); // .../Orient
const HOME = homedir();
const SKILLS_SRC = join(ROOT, "skills");

// Agents: an explicit, small set (the three the wall walls by name). Not globbed.
function agentLinks() {
  return ["execute.md", "critique.md", "self-improve.md"].map((f) => ({
    kind: "agent",
    linkPath: join(HOME, ".claude/agents", f),
    target: join(ROOT, "agents", f),
  }));
}

// Skills: GLOB-DISCOVERED. Every skills/<name>/ that has a SKILL.md becomes a link
// ~/.claude/skills/<name> -> skills/<name>. A new skill the self-improver writes is picked
// up here automatically, which is the whole point of this file.
function skillLinks() {
  let entries = [];
  try {
    entries = readdirSync(SKILLS_SRC, { withFileTypes: true });
  } catch {
    return []; // no skills/ dir: nothing to link
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const target = join(SKILLS_SRC, e.name);
    if (!existsSync(join(target, "SKILL.md"))) continue; // a skill must have a SKILL.md
    out.push({ kind: "skill", linkPath: join(HOME, ".claude/skills", e.name), target });
  }
  return out;
}

// Classify what would happen at linkPath, without mutating anything.
//   "missing"    nothing there -> will link
//   "link-ok"    already a symlink to the right target -> no-op
//   "link-diff"  a symlink to a DIFFERENT target -> will relink
//   "real"       a real file/dir (NOT a symlink) -> SKIP (never clobber)
function classify(linkPath, target) {
  if (!existsSync(linkPath) && !isSymlink(linkPath)) return "missing";
  if (isSymlink(linkPath)) {
    let cur = "";
    try { cur = readlinkSync(linkPath); } catch {}
    return cur === target ? "link-ok" : "link-diff";
  }
  return "real"; // exists and is not a symlink
}

// lstat-based symlink test that is true even for a broken (dangling) symlink.
function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function apply(linkPath, target, state) {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (state === "link-diff") {
    unlinkSync(linkPath); // remove the stale symlink, then relink below
  } else if (state === "real") {
    // Guard: should never reach here (real is filtered to skip), but be explicit.
    throw new Error(`refusing to replace non-symlink: ${linkPath}`);
  }
  symlinkSync(target, linkPath);
}

const linked = []; // newly created or relinked
const already = []; // already correct
const skipped = []; // real dir/file left untouched

for (const { kind, linkPath, target } of [...agentLinks(), ...skillLinks()]) {
  const state = classify(linkPath, target);
  const verb = APPLY ? "link" : "would link";
  if (state === "real") {
    skipped.push(`  SKIP  ${kind}: ${linkPath} (real dir/file, not a symlink — left untouched)`);
    continue;
  }
  if (state === "link-ok") {
    already.push(`  OK    ${kind}: ${linkPath} -> ${target}`);
    continue;
  }
  // missing or link-diff: we will (re)link it.
  linked.push(`  ${(verb.toUpperCase() + "  ").padEnd(12)}${kind}: ${linkPath} -> ${target}` + (state === "link-diff" ? " (relink)" : ""));
  if (APPLY) apply(linkPath, target, state);
}

function section(title, lines) {
  if (!lines.length) return;
  console.log(title);
  for (const l of lines) console.log(l);
}

section(APPLY ? "Linked:" : "Would link:", linked);
section("Already linked:", already);
section("Skipped (real, untouched):", skipped);

console.log(
  APPLY
    ? `Claude adapter installed. (${linked.length} linked, ${already.length} already ok, ${skipped.length} skipped)`
    : `Dry run only. Re-run with --apply to install. (${linked.length} would link, ${already.length} already ok, ${skipped.length} skipped)`
);

if (APPLY) {
  console.log("\nOne manual step left — always-on: add this line to ~/.claude/CLAUDE.md");
  console.log(`  @${join(ROOT, "core/orient-overview.md")}`);
}
