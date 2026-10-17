#!/usr/bin/env node
/*
 * skill-status.mjs: one table that says, for every skill in the library, where it came from
 * and whether it is earning its place. Joins two sources that already exist:
 *   - git: when the skill's SKILL.md was first committed and by whom (the self-improver or the
 *     owner); what it is for comes from the skill's own description line.
 *   - ~/.orient/skill-usage.json: use count, first and last use, written by hooks/skill-usage.mjs.
 *     Only Skill-tool calls are counted; a skill an agent reads with cat is not seen by the meter.
 *   - ~/.orient/skill-reads.codex.json: Codex's recognized SKILL.md reads (adapters/codex/skill-usage.mjs),
 *     a partial measure kept in its own column; the latest date from either file counts as last used.
 * Writes surface/skill-status.md and prints it; it never edits or deletes skills. The
 * weekly clean-skills pass reads the same numbers and proposes removals; deleting is the
 * owner's call.
 *
 * Usage: node surface/skill-status.mjs [--idle 30]   (flag skills idle longer than N days)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const USAGE = join(homedir(), ".orient", "skill-usage.json");
const READS = join(homedir(), ".orient", "skill-reads.codex.json");
const OUT = join(ROOT, "surface", "skill-status.md");
const idleArg = process.argv.indexOf("--idle");
const IDLE_DAYS = idleArg > -1 ? Number(process.argv[idleArg + 1]) || 30 : 30;

const git = (...a) => {
  try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return ""; }
};
const days = (iso) => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;
const date = (iso) => (iso ? iso.slice(0, 10) : "");

let usage = {}, reads = {};
let usageAvailable = false;
try { reads = JSON.parse(readFileSync(READS, "utf8")) || {}; } catch {}
try {
  const parsed = JSON.parse(readFileSync(USAGE, "utf8"));
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    usage = parsed;
    usageAvailable = true;
  }
} catch {}

const ignored = new Set(git("ls-files", "--others", "-i", "--exclude-standard", "--directory", "skills").split("\n").filter(Boolean).map((p) => p.split("/")[1]));

const rows = readdirSync(SKILLS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(SKILLS, d.name, "SKILL.md")))
  .map((d) => {
    const name = d.name;
    const file = `skills/${name}/SKILL.md`;
    // Oldest commit that added the file: "<date>\t<subject>".
    const first = git("log", "--diff-filter=A", "--follow", "--format=%ad\t%s", "--date=short", "--reverse", "--", file).split("\n")[0] || "";
    const [created, subject = ""] = first.split("\t");
    const by = !created ? "local, uncommitted" : /self-improver/i.test(subject) ? "the system" : "the owner";
    const desc = (readFileSync(join(SKILLS, name, "SKILL.md"), "utf8").match(/^description:\s*(.+)$/m) || [])[1] || "";
    const why = desc.replace(/^Use (when|for|whenever|before|at|to)\s*/i, "").split(/[.;,]/)[0].slice(0, 90);
    const shipped = git("ls-tree", "--name-only", "origin/main", file) ? "public" : ignored.has(name) ? "local only" : "local";
    const u = usage[name] || {}, r = reads[name] || {};
    const last = [u.last_used_at, r.last_used_at].filter(Boolean).sort().pop();
    const idle = days(last);
    return { name, created: created || "", by, why, shipped, uses: usageAvailable ? u.use_count || 0 : null, codexReads: r.use_count || 0, lastUse: date(last), idle };
  })
  .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));

const flag = (r) => (r.uses === null ? "usage data unavailable" : r.uses + r.codexReads === 0 ? "no recorded calls" : r.idle > IDLE_DAYS ? `no recorded calls in ${r.idle}d` : "");
const lines = [
  `# Skill status`,
  ``,
  `Generated ${new Date().toISOString().slice(0, 10)}. Recorded calls come from Claude's Skill-tool usage hook, Codex reads from its recognized SKILL.md reads, both since their hooks were wired; startup loading and other reads are not counted. Created and why come from git. A flag calls for a usage check, not a conclusion that a skill is unused.`,
  ``,
  `| skill | recorded calls | codex reads | last recorded | created | by | what for | where | flag |`,
  `|---|---:|---:|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.name} | ${r.uses ?? "unknown"} | ${r.codexReads} | ${r.lastUse} | ${r.created} | ${r.by} | ${r.why} | ${r.shipped} | ${flag(r)} |`),
  ``,
  `${rows.length} skills, ${rows.filter((r) => flag(r)).length} flagged for a usage check (no recorded calls, a gap over ${IDLE_DAYS} days, or unavailable usage data).`,
];
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(lines.join("\n"));
