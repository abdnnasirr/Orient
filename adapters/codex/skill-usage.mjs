#!/usr/bin/env node
import { realpathSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { recordUsage } from "../../hooks/skill-usage.mjs";
import { REPO, USER_HOME, isMain } from "./runtime.mjs";

// Codex loads skills through file reads, not Claude's Skill tool. Keep these
// observations separate: a read is not proof the skill was followed, and an
// unobserved read (or a preloaded skill) must not be reported as non-use.
export function observedSkillReads(payload) {
  const response = payload.tool_response || payload.tool_result || {};
  const code = response.exit_code ?? response.exitCode;
  if (code !== 0) return [];
  if (!/^(Bash|exec_command)$/.test(payload.tool_name || "")) return [];
  const command = payload.tool_input?.command || payload.tool_input?.cmd || "";
  if (typeof command !== "string" || /[\n;&|<>$`()]/.test(command)) return [];
  const tokens = [];
  let cursor = 0;
  for (const match of command.matchAll(/'[^']*'|"[^"\\]*"|[^\s'"]+/g)) {
    if (command.slice(cursor, match.index).trim()) return [];
    tokens.push(match[0]);
    cursor = match.index + match[0].length;
  }
  if (command.slice(cursor).trim()) return [];
  const args = tokens.map(t => /^['"]/.test(t) ? t.slice(1, -1) : t);
  if (basename(args.shift() || "") !== "cat") return [];
  const skills = new Set();
  for (const arg of args) {
    if (arg.startsWith("-")) continue;
    try {
      const file = realpathSync(resolve(payload.cwd || REPO, arg));
      if (basename(file) !== "SKILL.md") continue;
      const name = basename(dirname(file));
      if (file === realpathSync(join(REPO, "skills", name, "SKILL.md"))) skills.add(name);
    } catch { /* partial coverage is preferable to inventing a use */ }
  }
  return [...skills];
}

if (isMain(import.meta.url)) {
  try {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    const reads = observedSkillReads(JSON.parse(raw || "{}"));
    if (reads.length) {
      mkdirSync(join(USER_HOME, ".orient"), { recursive: true });
      for (const skill of reads) recordUsage(skill, join(USER_HOME, ".orient", "skill-reads.codex.json"));
    }
  } catch { /* observability never blocks work */ }
}
