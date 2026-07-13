#!/usr/bin/env node
/*
 * skill-usage.mjs: measures which skills actually get used, so the library can stop only
 * growing. Without a use count, unused skills silently accumulate; this hook is the meter
 * that lets the weekly clean-skills pass surface the stale ones to the owner.
 *
 * Wired as a PreToolUse hook (matcher "Skill"). On every Skill tool call it reads the skill
 * name and upserts ~/.orient/skill-usage.json:
 *   { "<skill>": { use_count, first_used_at, last_used_at } }
 * use_count increments, first_used_at is stamped once, last_used_at on every call.
 *
 * FAIL-OPEN, ALWAYS: this only observes; it must NEVER block or slow a tool call. Any fault
 * (unparseable input, missing fields, unwritable state, a non-Skill call) exits 0 silently
 * with no output. A meter that can veto a tool call is worse than no meter. It is not the
 * wall: the wall fails closed, this fails open, because logging usage is never a safety gate.
 */
import { readFileSync, writeFileSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ORIENT_DIR = join(homedir(), ".orient");
const USAGE = join(ORIENT_DIR, "skill-usage.json");

function readStdin() {
  return new Promise((res) => {
    let d = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(d));
  });
}

// Durable read-modify-write of the usage map. fsync so a count survives a crash right after.
// Any error is swallowed by the caller; a lost increment is acceptable, a blocked tool is not.
function bump(skill) {
  const now = new Date().toISOString();
  let usage = {};
  try { usage = JSON.parse(readFileSync(USAGE, "utf8")) || {}; } catch {}
  const rec = usage[skill] && typeof usage[skill] === "object" ? usage[skill] : {};
  const prev = Number.isFinite(rec.use_count) && rec.use_count >= 0 ? rec.use_count : 0;
  usage[skill] = {
    use_count: prev + 1,
    first_used_at: rec.first_used_at || now,
    last_used_at: now,
  };
  mkdirSync(ORIENT_DIR, { recursive: true });
  const fd = openSync(USAGE, "w");
  try {
    writeSync(fd, JSON.stringify(usage, null, 2));
    try { fsyncSync(fd); } catch {}
  } finally { closeSync(fd); }
}

async function main() {
  try {
    const payload = JSON.parse((await readStdin()) || "{}");
    // Only Skill calls carry a skill to count. A tool_name present and not "Skill" is ignored.
    if (payload && payload.tool_name && payload.tool_name !== "Skill") process.exit(0);
    const skill = payload && payload.tool_input && payload.tool_input.skill;
    if (typeof skill !== "string" || !skill.trim()) process.exit(0); // no skill name: ignore
    bump(skill.trim());
  } catch {} // FAIL-OPEN: any fault is swallowed, never blocks the tool call.
  process.exit(0);
}
main();
