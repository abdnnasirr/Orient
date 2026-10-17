import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve, delimiter } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readSelfImprover } from "../../hooks/self-improver.mjs";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const USER_HOME = resolve(process.env.ORIENT_USER_HOME || homedir());
export const CODEX_HOME = resolve(process.env.CODEX_HOME || join(USER_HOME, ".codex"));
export const STATE = join(USER_HOME, ".orient", "codex");
export const SETTINGS = join(STATE, "adapter.json");
export const START = "<!-- orient:codex:start -->";
export const END = "<!-- orient:codex:end -->";

function sameFile(a, b) {
  const left = statSync(a), right = statSync(b);
  return left.dev === right.dev && left.ino === right.ino;
}

export function isMain(meta) {
  if (!process.argv[1]) return false;
  return sameFile(fileURLToPath(meta), process.argv[1]);
}

export function settings() {
  if (!existsSync(SETTINGS)) return {};
  return JSON.parse(readFileSync(SETTINGS, "utf8"));
}

// The shared prompts keep their Claude vocabulary. Translate runtime names only
// in Codex's generated view, never in the maintained source or skill contents.
export function forCodex(text) {
  return text.replace(/ \((?:Sonnet|Opus)\)/g, "")
    .replace(/\bSonnet\b/g, "a lighter available model")
    .replace(/\bOpus\b/g, "a stronger available model")
    .replaceAll("~/.claude/skills", "~/.agents/skills");
}

export function agent(name) {
  const source = readFileSync(join(REPO, "agents", `${name}.md`), "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Missing agent metadata: ${name}`);
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1];
  if (!description) throw new Error(`Missing agent description: ${name}`);
  const list = match[1].match(/^skills:\s*\n((?:[ \t]+- .*(?:\n|$))*)/m)?.[1] || "";
  const skills = [...list.matchAll(/^[ \t]+-\s*([\w-]+)\s*$/gm)].map(m => m[1]);
  return { name, description, body: forCodex(match[2].trim()), skills };
}

export function personalGuidance(file) {
  if (!file) return "";
  const output = join(CODEX_HOME, "AGENTS.md");
  if (existsSync(output) && sameFile(file, output)) {
    throw new Error("Preferences must come from a source file, not the generated Codex AGENTS.md or an alias of it.");
  }
  const source = readFileSync(file, "utf8");
  if (source.includes(START) || source.includes(END)) {
    throw new Error("Preferences must not contain Orient's generated managed section; use its original source file.");
  }
  const overview = realpathSync(join(REPO, "core/orient-overview.md"));
  // Import only the personal portion of a CLAUDE.md. Do not copy its Orient
  // import as literal text, or silently follow arbitrary additional imports.
  return source.split(/\r?\n/).filter(line => {
    if (!line.trim().startsWith("@")) return true;
    const target = resolve(dirname(file), line.trim().slice(1));
    if (existsSync(target) && sameFile(target, overview)) return false;
    throw new Error(`Use a plain preferences file; unsupported import in ${file}: ${line}`);
  }).join("\n").trim();
}

export function guidance(config = {}) {
  const personal = personalGuidance(config.preferencesFile);
  const overview = forCodex(readFileSync(join(REPO, "core/orient-overview.md"), "utf8").trim());
  const owner = readSelfImprover(join(USER_HOME, ".orient"));
  const improvement = owner === "claude"
    ? "Claude owns automatic self-improvement. Codex uses the shared skills, but its compaction does not launch background edits."
    : owner === "codex"
      ? "Codex owns automatic self-improvement, using its own runner and restricted filesystem permissions. Claude compaction does not launch background edits."
      : "Automatic self-improvement is disabled because the shared selfImprover setting is invalid or unreadable.";
  return [personal, overview, `## Codex runtime\n\nThe shared Orient files live at ${REPO}. Use the installed execute and critique agents for those roles. Their startup instructions include the skills declared in the shared agent files. Choose models available in this Codex session; when no override is needed, inherit the configured model. Load a skill's supporting references when its instructions call for them. ${improvement}\n\nThis section is generated from the shared repository${config.preferencesFile ? ` and ${config.preferencesFile}` : ""}. Change those sources, then rerun the installer or start a new session; do not maintain a second copy here.`].filter(Boolean).join("\n\n");
}

export function agentInstructions(name, config = {}) {
  const role = agent(name);
  const preloads = role.skills.map(skill => {
    const file = join(REPO, "skills", skill, "SKILL.md");
    return `## Loaded skill: ${skill}\n\nSource: ${file}\n\n${readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim()}`;
  });
  return [guidance(config), role.body, ...preloads].join("\n\n");
}

export function codexExecutable(config = {}) {
  const candidates = [process.env.ORIENT_CODEX_BIN, config.codexBin,
    ...(process.env.PATH || "").split(delimiter).map(p => join(p, process.platform === "win32" ? "codex.exe" : "codex")),
    "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex",
    "/Applications/Codex.app/Contents/Resources/codex"];
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    if (!existsSync(candidate)) continue;
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (result.status === 0 && /codex/i.test(result.stdout)) return candidate;
  }
  throw new Error("No working Codex executable found. Set ORIENT_CODEX_BIN or install the Codex CLI.");
}

export const shellQuote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
