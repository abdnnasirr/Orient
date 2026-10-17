import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { REPO, USER_HOME, CODEX_HOME, STATE, agentInstructions, codexExecutable, settings } from "./runtime.mjs";

// Resolve existing ancestors too: private runtime folders may not exist yet.
function canonical(path) {
  try { return realpathSync(path); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return join(canonical(dirname(path)), basename(path));
  }
}
function contains(parent, child) {
  const path = relative(parent, child);
  return !path || (path !== ".." && !path.startsWith("../") && !isAbsolute(path));
}

export function minerPermissions(brain = "") {
  const files = {
    ":root": "read",
    [REPO]: "read",
    [CODEX_HOME]: "read",
    [join(USER_HOME, ".claude")]: "read",
    [join(USER_HOME, ".agents")]: "read",
    [join(USER_HOME, ".orient")]: "read",
    [join(REPO, "skills")]: "write",
    [join(REPO, "skills", "orient")]: "read",
    [join(REPO, "evals")]: "write",
    [join(STATE, "work")]: "write",
    [join(USER_HOME, ".orient", "self-improve.log")]: "write",
    [join(USER_HOME, ".orient", "config.json")]: "deny",
    [join(CODEX_HOME, "auth.json")]: "deny",
  };
  if (brain) {
    const target = realpathSync(brain);
    const protectedRoots = [REPO, CODEX_HOME, join(USER_HOME, ".claude"), join(USER_HOME, ".agents"), join(USER_HOME, ".orient")].map(canonical);
    if (!statSync(target).isDirectory() || protectedRoots.some(root => contains(target, root) || contains(root, target))) {
      throw new Error("Brain must be a separate notes folder that does not overlap the harness or tool configuration.");
    }
    files[target] = "write";
  }
  return Object.fromEntries(Object.entries(files).map(([path, mode]) => [path === ":root" ? path : canonical(path), mode]));
}

export function minerArgs(prompt, config = settings(), brain = "") {
  const permissions = Object.entries(minerPermissions(brain)).map(([key, value]) => `${JSON.stringify(key)} = ${JSON.stringify(value)}`).join(", ");
  const args = ["--no-daemon", "-a", "never", "exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral", "--json", "--cd", join(STATE, "work"),
    "-c", 'features.psp=true',
    "-c", 'default_permissions="orient_miner"',
    "-c", `permissions.orient_miner.filesystem={ ${permissions} }`,
    "-c", "permissions.orient_miner.network.enabled=false",
    "-c", "features.hooks=false", "-c", "features.apps=false", "-c", "features.plugins=false", "-c", "features.multi_agent=false",
    "-c", `developer_instructions=${JSON.stringify(agentInstructions("self-improve", config))}`];
  if (config.minerModel) args.push("--model", config.minerModel);
  args.push(prompt);
  return args;
}

export function fireCodex(prompt, { dry = false, noSpawn = false, brain = "", log = () => {} } = {}) {
  const config = settings();
  const binary = codexExecutable(config);
  const args = minerArgs(prompt, config, brain);
  if (dry || noSpawn) {
    const line = `WOULD SPAWN${noSpawn ? " (no-spawn)" : ""}: ${binary} ${JSON.stringify(args)}`;
    if (dry) console.log(line); else log(line);
    return;
  }
  mkdirSync(join(STATE, "work"), { recursive: true });
  mkdirSync(join(REPO, "evals"), { recursive: true });
  const output = join(STATE, "miner-output.jsonl");
  const fd = openSync(output, "a", 0o600);
  try {
    // User configuration is deliberately not inherited by the autonomous child:
    // it must not turn the bounded filesystem profile into full access. Auth is
    // still provided by Codex, not copied or handled by this adapter.
    const child = spawn(binary, args, { detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, ORIENT_SELF_IMPROVE_CHILD: "1" } });
    child.on("error", error => log(`Codex self-improver could not start: ${error.message}`));
    child.unref();
  } finally { closeSync(fd); }
}
