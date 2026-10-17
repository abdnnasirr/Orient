import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtures = [];
function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "orient-codex-test-"))); fixtures.push(base);
  const repo = join(base, "repo"), user = join(base, "user");
  for (const dir of ["adapters/codex", "hooks", "agents", "core", "skills/build", "skills/technical-critique", "skills/orient", "evals"]) mkdirSync(join(repo, dir), { recursive: true });
  cpSync(join(source, "adapters/codex"), join(repo, "adapters/codex"), { recursive: true, filter: path => !path.endsWith(".test.mjs") });
  for (const file of ["self-improve-trigger.mjs", "self-improver.mjs", "skill-usage.mjs"]) cpSync(join(source, "hooks", file), join(repo, "hooks", file));
  writeFileSync(join(repo, "core/orient-overview.md"), "# Orient\nShared overview v1. Sonnet handles routine work; Opus handles judgment.\n");
  for (const name of ["execute", "critique", "self-improve"]) {
    const skill = name === "execute" ? "build" : name === "critique" ? "technical-critique" : null;
    writeFileSync(join(repo, "agents", `${name}.md`), `---\nname: ${name}\ndescription: Role ${name}\n${skill ? `skills:\n  - ${skill}\n` : ""}---\n${name}: shared role v1. Use ~/.claude/skills.\n`);
  }
  for (const name of ["build", "technical-critique", "orient"]) writeFileSync(join(repo, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name}\n---\n${name}: source v1.\n`);
  const env = { ...process.env, ORIENT_USER_HOME: user };
  // Do not redirect HOME or the user's Codex authentication directory.
  assert.equal(process.env.CODEX_HOME, undefined, "Run isolated tests without a custom CODEX_HOME");
  const run = (args = [], extra = {}) => spawnSync(process.execPath, [join(repo, "adapters/codex/install.mjs"), ...args], { env: { ...env, ...extra }, encoding: "utf8" });
  const moduleRun = (module, expression, extra = {}) => spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify("file://" + join(repo, "adapters/codex", module))});\n${expression}`], { env: { ...env, ...extra }, encoding: "utf8" });
  return { base, repo, user, env, run, moduleRun, global: join(user, ".codex/AGENTS.md"), hooks: join(user, ".codex/hooks.json") };
}
test.after(() => fixtures.forEach(path => rmSync(path, { recursive: true, force: true })));

test("dry run creates no user files", () => {
  const f = fixture(), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run/);
  assert.equal(existsSync(f.user), false);
});

test("entry and overview aliases resolve to the real files", () => {
  const f = fixture(), entry = join(f.base, "installer.mjs"), overview = join(f.base, "overview.md"), prefs = join(f.base, "prefs.md");
  symlinkSync(join(f.repo, "adapters/codex/install.mjs"), entry);
  linkSync(join(f.repo, "core/orient-overview.md"), overview);
  writeFileSync(prefs, `My preferences.\n@${overview}\n`);
  const result = spawnSync(process.execPath, [entry, "--apply", "--preferences", prefs], { env: f.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed/);
  assert.equal(readFileSync(f.global, "utf8").match(/Shared overview v1/g).length, 1);
});

test("installation preserves guidance, hooks and config; rerun is inert", () => {
  const f = fixture(); mkdirSync(join(f.user, ".codex"), { recursive: true });
  writeFileSync(f.global, "# My existing guidance\nKeep this.\n");
  const custom = { description: "Mine", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo keep" }] }] } };
  writeFileSync(f.hooks, JSON.stringify(custom));
  writeFileSync(join(f.user, ".codex/config.toml"), 'model = "my-model"\n');
  const result = f.run(["--apply"]); assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(f.global, "utf8"), /^# My existing guidance\nKeep this/);
  const hooks = JSON.parse(readFileSync(f.hooks));
  assert.deepEqual(hooks.hooks.Stop, custom.hooks.Stop);
  assert.equal(hooks.description, "Mine");
  assert.equal(readFileSync(join(f.user, ".codex/config.toml"), "utf8"), 'model = "my-model"\n');
  const skill = join(f.user, ".agents/skills/build");
  assert.equal(lstatSync(skill).isSymbolicLink(), true);
  assert.equal(readlinkSync(skill), join(f.repo, "skills/build"));
  const agent = readFileSync(join(f.user, ".codex/agents/execute.toml"), "utf8");
  assert.match(agent, /execute: shared role v1/); assert.match(agent, /build: source v1/);
  assert.doesNotMatch(agent, /~\/\.claude\/skills/);
  const second = f.run(); assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Already installed/);
});

test("source preferences are expanded once, refreshed, and kept private", () => {
  const f = fixture(), prefs = join(f.base, "CLAUDE.md");
  writeFileSync(prefs, `# How I work\nBe clear.\n\n@${join(f.repo, "core/orient-overview.md")}\n`);
  let result = f.run(["--apply", "--preferences", prefs]); assert.equal(result.status, 0, result.stderr);
  let global = readFileSync(f.global, "utf8");
  assert.match(global, /Be clear/); assert.equal(global.match(/Shared overview v1/g).length, 1);
  assert.doesNotMatch(global, /@.*orient-overview/);
  assert.match(global, /a lighter available model/); assert.doesNotMatch(global, /\bSonnet\b|\bOpus\b/);
  writeFileSync(prefs, "# How I work\nKeep the reasoning.\n");
  writeFileSync(join(f.repo, "core/orient-overview.md"), "# Orient\nShared overview v2.\n");
  writeFileSync(join(f.repo, "skills/build/SKILL.md"), "# Build\nUpdated startup standard.\n");
  mkdirSync(join(f.repo, "skills/new-skill")); writeFileSync(join(f.repo, "skills/new-skill/SKILL.md"), "# New\n");
  result = spawnSync(process.execPath, [join(f.repo, "adapters/codex/session-start.mjs")], { env: f.env, encoding: "utf8", input: "{}" });
  assert.equal(result.status, 0, result.stderr);
  const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Keep the reasoning/); assert.match(context, /Shared overview v2/);
  assert.match(readFileSync(join(f.user, ".codex/agents/execute.toml"), "utf8"), /Updated startup standard/);
  assert.equal(readlinkSync(join(f.user, ".agents/skills/new-skill")), join(f.repo, "skills/new-skill"));
  assert.equal(readFileSync(join(f.repo, "core/orient-overview.md"), "utf8"), "# Orient\nShared overview v2.\n");
});

for (const kind of ["direct", "symlink", "hardlink", "copy"]) {
  test(`generated guidance cannot become its own preferences source: ${kind}`, () => {
    const f = fixture(), installed = f.run(["--apply"]);
    assert.equal(installed.status, 0, installed.stderr);
    let preferences = f.global;
    if (kind !== "direct") {
      preferences = join(f.base, "preferences.md");
      if (kind === "symlink") symlinkSync(f.global, preferences);
      else if (kind === "hardlink") linkSync(f.global, preferences);
      else cpSync(f.global, preferences);
    }
    const before = snapshot(f.user);
    const refused = f.run(["--apply", "--preferences", preferences]);
    assert.notEqual(refused.status, 0, "generated output must be rejected as a source");
    assert.match(refused.stderr, /preferences.*(?:generated|managed)/i);
    assert.deepEqual(snapshot(f.user), before, "preflight must preserve guidance, hooks, settings and backups");
    const rerun = f.run();
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout, /Already installed/);
  });
}

for (const kind of ["real skill", "foreign skill link", "foreign agent", "malformed hooks", "override", "global symlink", "broken markers"]) {
  test(`preflight leaves existing files untouched: ${kind}`, () => {
    const f = fixture(); mkdirSync(join(f.user, ".codex/agents"), { recursive: true }); mkdirSync(join(f.user, ".agents/skills"), { recursive: true });
    writeFileSync(f.global, kind === "broken markers" ? "<!-- orient:codex:start -->\nbroken" : "Keep original guidance.\n");
    if (kind === "real skill") mkdirSync(join(f.user, ".agents/skills/build"));
    if (kind === "foreign skill link") symlinkSync(f.base, join(f.user, ".agents/skills/build"));
    if (kind === "foreign agent") writeFileSync(join(f.user, ".codex/agents/execute.toml"), "My own agent.\n");
    if (kind === "malformed hooks") writeFileSync(f.hooks, "not JSON");
    if (kind === "override") writeFileSync(join(f.user, ".codex/AGENTS.override.md"), "Active override\n");
    if (kind === "global symlink") { rmSync(f.global); const target = join(f.base, "keep.md"); writeFileSync(target, "Keep original guidance.\n"); symlinkSync(target, f.global); }
    const before = readFileSync(f.global, "utf8"), result = f.run(["--apply"]);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(f.global, "utf8"), before);
    assert.equal(existsSync(join(f.user, ".orient/codex/adapter.json")), false);
    assert.equal(existsSync(join(f.user, ".agents/skills/orient")), false);
  });
}

test("Codex usage observations stay separate and do not invent unobserved uses", () => {
  const f = fixture(), file = join(f.repo, "skills/build/SKILL.md");
  const result = f.moduleRun("skill-usage.mjs", `
    const good={tool_name:'Bash',tool_input:{command:'cat '+${JSON.stringify(file)}},tool_response:{exit_code:0}};
    console.log(JSON.stringify({good:m.observedSkillReads(good),failed:m.observedSkillReads({...good,tool_response:{exit_code:1}}),unknown:m.observedSkillReads({...good,tool_response:{}}),complex:m.observedSkillReads({...good,tool_input:{command:good.tool_input.command+'; echo no'}})}));`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { good: ["build"], failed: [], unknown: [], complex: [] });
  const meter = spawnSync(process.execPath, [join(f.repo, "adapters/codex/skill-usage.mjs")], { env: f.env, encoding: "utf8", input: JSON.stringify({ tool_name: "Bash", tool_input: { command: `cat ${file}` }, tool_response: { exit_code: 0 } }) });
  assert.equal(meter.status, 0, meter.stderr);
  assert.equal(JSON.parse(readFileSync(join(f.user, ".orient/skill-reads.codex.json"))).build.use_count, 1);
  assert.equal(existsSync(join(f.user, ".orient/skill-usage.json")), false);
});

test("Codex trigger reuses incremental slicing and never chooses the Claude runner", () => {
  const f = fixture(), fake = join(f.base, "codex");
  mkdirSync(join(f.user, ".orient"), { recursive: true });
  writeFileSync(join(f.user, ".orient/config.json"), JSON.stringify({ selfImprover: "codex" }));
  writeFileSync(fake, '#!/bin/sh\nprintf "codex-test\\n"\n', { mode: 0o755 });
  let result = f.run(["--apply", "--codex-bin", fake]); assert.equal(result.status, 0, result.stderr);
  const transcript = join(f.base, "session.jsonl"); writeFileSync(transcript, '{"message":"first"}\n');
  const trigger = () => spawnSync(process.execPath, [join(f.repo, "adapters/codex/pre-compact.mjs")], { env: { ...f.env, SELF_IMPROVE_NO_SPAWN: "1" }, input: JSON.stringify({ transcript_path: transcript }), encoding: "utf8" });
  result = trigger(); assert.equal(result.status, 0, result.stderr);
  const state = join(f.user, ".orient/_mined-state.json");
  assert.equal(JSON.parse(readFileSync(state))[transcript], Buffer.byteLength(readFileSync(transcript)));
  const log = readFileSync(join(f.user, ".orient/self-improve.log"), "utf8");
  assert.match(log, /WOULD SPAWN \(no-spawn\).*codex/); assert.doesNotMatch(log, /WOULD SPAWN \(no-spawn\): claude/);
  assert.match(log, /orient_miner/); assert.doesNotMatch(log, /dangerously-bypass-approvals-and-sandbox/);
  assert.match(log, /\[runtime=codex\]/);
  assert.match(log, /skill-reads\.codex\.json/);
  result = trigger(); assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(f.user, ".orient/self-improve.log"), "utf8"), /no new bytes/);
  assert.equal(existsSync(join(f.user, ".claude")), false);
});

test("installer follows one shared owner and removes only its own compaction hook", () => {
  const f = fixture(), directory = join(f.user, ".orient"), configFile = join(directory, "config.json");
  mkdirSync(directory, { recursive: true }); mkdirSync(dirname(f.hooks), { recursive: true });
  const foreign = { hooks: [{ type: "command", command: "echo my compaction hook" }] };
  writeFileSync(f.hooks, JSON.stringify({ hooks: { PreCompact: [foreign] } }));
  const configure = owner => {
    const value = JSON.stringify({ selfImprover: owner, brain: "existing-vault", oauthToken: "private-test-token", other: { keep: true } });
    writeFileSync(configFile, value);
    const result = f.run(["--apply"]); assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(configFile, "utf8"), value);
    assert.doesNotMatch(readFileSync(f.global, "utf8"), /private-test-token|existing-vault/);
    return JSON.parse(readFileSync(f.hooks)).hooks.PreCompact;
  };
  const codex = configure("codex");
  assert.equal(codex.length, 2); assert.deepEqual(codex[0], foreign);
  assert.match(codex[1].hooks[0].command, /pre-compact\.mjs/);
  assert.match(readFileSync(f.global, "utf8"), /Codex owns automatic self-improvement/);
  assert.deepEqual(configure("claude"), [foreign]);
  assert.match(readFileSync(f.global, "utf8"), /Claude owns automatic self-improvement/);
  assert.match(readFileSync(f.global, "utf8"), /compaction does not launch background edits/);
  assert.deepEqual(configure("both"), [foreign]);
  assert.match(readFileSync(f.global, "utf8"), /disabled/);
});

test("legacy installation defaults to Claude without a Codex compaction hook", () => {
  const f = fixture(), result = f.run(["--apply"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(f.hooks)).hooks.PreCompact, undefined);
  assert.equal(existsSync(join(f.user, ".orient/config.json")), false);
  assert.match(readFileSync(f.global, "utf8"), /Claude owns automatic self-improvement/);
});

function snapshot(directory) {
  if (!existsSync(directory)) return null;
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).map(entry => {
    const path = join(directory, entry.name);
    return [entry.name, entry.isSymbolicLink() ? { link: readlinkSync(path) } : entry.isDirectory() ? snapshot(path) : readFileSync(path, "utf8")];
  }));
}

for (const scenario of ["missing", "legacy", "claude", "codex", "both", "malformed", "null", "unreadable", "broken link"]) {
  test(`nonselected or invalid triggers are inert before every state write: ${scenario}`, () => {
    const f = fixture(), directory = join(f.user, ".orient"), configFile = join(directory, "config.json");
    if (scenario !== "missing") {
      mkdirSync(directory, { recursive: true });
      if (scenario === "unreadable") mkdirSync(configFile);
      else if (scenario === "broken link") symlinkSync(join(f.base, "missing-config.json"), configFile);
      else writeFileSync(configFile, scenario === "malformed" ? "{" : scenario === "null" ? "null" : JSON.stringify(scenario === "legacy" ? { brain: "notes", oauthToken: "private-test-token" } : { selfImprover: scenario }));
    }
    const installer = join(f.base, "installer.mjs"), marker = join(f.base, "installer-ran");
    writeFileSync(installer, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'ran');`);
    const transcript = join(f.base, "session.jsonl"); writeFileSync(transcript, '{"message":"unmined"}\n');
    const before = scenario === "broken link" ? readlinkSync(configFile) : snapshot(directory);
    const selected = ["missing", "legacy", "claude"].includes(scenario) ? "claude" : scenario === "codex" ? "codex" : null;
    for (const runtime of ["claude", "codex"].filter(runtime => runtime !== selected)) {
      const result = spawnSync(process.execPath, [join(f.repo, "hooks/self-improve-trigger.mjs"), ...(runtime === "codex" ? ["--runtime=codex"] : [])], {
        env: { ...f.env, SELF_IMPROVE_NO_SPAWN: "1", SELF_IMPROVE_INSTALLER: installer },
        input: JSON.stringify({ transcript_path: transcript }), encoding: "utf8", timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(marker), false, "selection must precede the installer");
      if (scenario === "broken link") {
        assert.deepEqual(readdirSync(directory), ["config.json"]);
        assert.equal(readlinkSync(configFile), before);
      } else assert.deepEqual(snapshot(directory), before, "no log, lock, stamp, slice, offset or spawn output may be written");
      assert.doesNotMatch(result.stdout + result.stderr, /private-test-token/);
    }
  });
}

for (const runtime of ["claude", "codex"]) {
  test(`selected ${runtime} alone advances state, with its runtime recorded`, () => {
    const f = fixture(), directory = join(f.user, ".orient"), configFile = join(directory, "config.json");
    mkdirSync(directory, { recursive: true });
    const config = JSON.stringify({ selfImprover: runtime, oauthToken: "private-test-token" }); writeFileSync(configFile, config);
    const installer = join(f.base, "installer.mjs"); writeFileSync(installer, "process.exit(0);");
    const binary = join(f.base, "codex"); writeFileSync(binary, '#!/bin/sh\nprintf "codex-test\\n"\n', { mode: 0o755 });
    const transcript = join(f.base, "session.jsonl"); writeFileSync(transcript, '{"message":"selected"}\n');
    const result = spawnSync(process.execPath, [join(f.repo, "hooks/self-improve-trigger.mjs"), ...(runtime === "codex" ? ["--runtime=codex"] : [])], {
      env: { ...f.env, SELF_IMPROVE_NO_SPAWN: "1", SELF_IMPROVE_INSTALLER: installer, ORIENT_CODEX_BIN: binary },
      input: JSON.stringify({ transcript_path: transcript }), encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(join(directory, "_mined-state.json")))[transcript], Buffer.byteLength(readFileSync(transcript)));
    assert.equal(readFileSync(configFile, "utf8"), config);
    const log = readFileSync(join(directory, "self-improve.log"), "utf8");
    assert.match(log, new RegExp(`\\[runtime=${runtime}\\]`));
    assert.match(log, new RegExp(`triggered by ${runtime} compaction`));
    assert.match(log, /change summaries and run-log entries/);
    assert.match(log, /WOULD SPAWN \(no-spawn\)/);
    assert.doesNotMatch(log, /private-test-token/);
  });
}

test("autonomous runner constrains writes instead of inheriting full access", () => {
  const f = fixture();
  const result = f.moduleRun("self-improve.mjs", "console.log(JSON.stringify({rules:m.minerPermissions(),args:m.minerArgs('test',{})}));");
  assert.equal(result.status, 0, result.stderr);
  const { rules, args } = JSON.parse(result.stdout);
  assert.equal(rules[join(f.repo, "skills")], "write");
  assert.equal(rules[join(f.repo, "skills/orient")], "read");
  assert.equal(rules[":root"], "read");
  assert.ok(args.includes("--ignore-user-config"));
  assert.ok(args.includes("features.hooks=false"));
  assert.ok(args.includes('default_permissions="orient_miner"'));
  assert.equal(args.includes("--sandbox"), false, "legacy sandbox flags override permission profiles");
  assert.equal(args.some(a => a.includes("danger-full-access")), false);
});

test("brain notes cannot reopen the harness or either tool's startup files", () => {
  const f = fixture();
  const vault = join(f.user, "notes"); mkdirSync(vault, { recursive: true });
  for (const dir of [".codex/nested", ".claude", ".agents", ".orient/codex"]) mkdirSync(join(f.user, dir), { recursive: true });
  const alias = join(f.base, "repo-parent-alias"); symlinkSync(f.base, alias);
  const paths = [f.base, f.repo, join(f.repo, "skills"), f.user, join(f.user, ".codex"), join(f.user, ".codex/nested"), join(f.user, ".claude"), join(f.user, ".agents"), join(f.user, ".orient"), alias];
  const result = f.moduleRun("self-improve.mjs", `
    const rejected=${JSON.stringify(paths)}.map(path=>{try {m.minerPermissions(path); return false;} catch {return true;}});
    console.log(JSON.stringify({rejected,rules:m.minerPermissions(${JSON.stringify(vault)})}));`);
  assert.equal(result.status, 0, result.stderr);
  const { rejected, rules } = JSON.parse(result.stdout);
  assert.deepEqual(rejected, paths.map(() => true));
  assert.equal(rules[vault], "write");
  assert.equal(rules[f.repo], "read");
  assert.equal(rules[join(f.user, ".codex")], "read");
});

test("native Codex sandbox allows skill creation and blocks core writes, including aliases", t => {
  const f = fixture();
  const found = f.moduleRun("runtime.mjs", "try { console.log(m.codexExecutable()); } catch { process.exitCode=2; }");
  if (found.status !== 0) { t.skip("A working Codex CLI is required for the native boundary proof"); return; }
  const cli = found.stdout.trim();
  const vault = join(f.user, "notes"); mkdirSync(vault, { recursive: true });
  const startup = join(f.user, ".codex/AGENTS.md"); mkdirSync(dirname(startup), { recursive: true }); writeFileSync(startup, "Protected startup");
  const result = f.moduleRun("self-improve.mjs", `console.log(JSON.stringify(m.minerPermissions(${JSON.stringify(vault)})));`);
  assert.equal(result.status, 0, result.stderr);
  const rules = JSON.parse(result.stdout);
  const table = Object.entries(rules).map(([k,v])=>`${JSON.stringify(k)} = ${JSON.stringify(v)}`).join(", ");
  const alias = join(f.base, "core-alias"); symlinkSync(join(f.repo, "skills/orient"), alias);
  const probe = `const fs=require('fs'); const path=require('path'); const repo=${JSON.stringify(f.repo)}; fs.mkdirSync(path.join(repo,'skills/new-example')); fs.writeFileSync(path.join(repo,'skills/new-example/SKILL.md'),'new skill'); fs.writeFileSync(${JSON.stringify(join(vault,"note.md"))},"Allowed note"); let blocked=0; for(const p of [${JSON.stringify(startup)},path.join(repo,'core/orient-overview.md'),path.join(repo,'skills/orient/SKILL.md'),${JSON.stringify(join(alias,"SKILL.md"))}]) { try { fs.appendFileSync(p,'FORBIDDEN'); } catch(e) { if(e.code==='EPERM'||e.code==='EACCES') blocked++; else throw e; } } console.log(JSON.stringify({created:true,blocked}));`;
  const proof = spawnSync(cli, ["sandbox", "-P", "orient_miner", "-c", `permissions.orient_miner.filesystem={ ${table} }`, "-c", "permissions.orient_miner.network.enabled=false", "-C", f.repo, process.execPath, "-e", probe], { encoding: "utf8", timeout: 30000 });
  assert.equal(proof.status, 0, proof.stderr);
  assert.deepEqual(JSON.parse(proof.stdout), { created: true, blocked: 4 });
  assert.doesNotMatch(readFileSync(join(f.repo,"skills/orient/SKILL.md"),"utf8"), /FORBIDDEN/);
  assert.doesNotMatch(readFileSync(join(f.repo,"core/orient-overview.md"),"utf8"), /FORBIDDEN/);
});
