import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

// One shared owner for automatic edits. Missing legacy configuration keeps
// Claude's existing behavior; malformed or unreadable configuration enables none.
export function readSelfImprover(orientDirectory) {
  let config;
  try { config = JSON.parse(readFileSync(join(orientDirectory, "config.json"), "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") return null;
    // A broken config symlink is unreadable configuration, not a legacy absence.
    try { lstatSync(join(orientDirectory, "config.json")); return null; }
    catch (missing) { return missing.code === "ENOENT" ? "claude" : null; }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  if (!Object.hasOwn(config, "selfImprover")) return "claude";
  return ["claude", "codex"].includes(config.selfImprover) ? config.selfImprover : null;
}
