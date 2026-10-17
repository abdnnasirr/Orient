# Codex setup

This installs Orient for Codex alongside Claude. Both tools read the same skill folders; you edit a skill once. The overview and agent files remain the maintained sources. Codex's generated files contain their actual text, with the runtime names adapted and the agents' declared skills included at startup.

## Choose the self-improver

**Choose one tool to make automatic improvements: Claude or Codex.** Both tools use the same skills. The chosen tool learns from its own sessions and maintains those skills; sessions from the other tool are not automatically passed over for review.

Follow the choice in [the shared setup](../../docs/SETUP.md#choose-the-self-improver). Save `"selfImprover": "claude"` or `"selfImprover": "codex"` in `~/.orient/config.json`, preserving its other settings. With no choice saved, Claude remains responsible, so adding Codex leaves an existing Claude setup in charge. No value enables both. To switch, let existing background work finish, change the choice, and rerun this installer.

## Install globally

Use a permanent clone of Orient, not a temporary folder. Run from the repo root:

```bash
node adapters/codex/install.mjs
node adapters/codex/install.mjs --apply --verify
```

The first command is a dry run. The second applies it and checks that a working Codex executable is available. The adapter uses current Codex support for global skills, standalone custom agents, hooks, and permission profiles. It is tested with Codex CLI 0.162 on macOS and Node 22. Use a current Codex release; do not declare an older or untested runtime compatible without running the checks below.

The installer:

- Links each `skills/<name>` folder into `~/.agents/skills`, including references, scripts, and assets.
- Adds an Orient section to `~/.codex/AGENTS.md`, preserving existing personal guidance outside that section.
- Generates Execute, Critique, and Self-improve configurations under `~/.codex/agents` from `agents/*.md`. Execute and Critique include their declared skill contents, rather than only a reference to a file.
- Merges Orient's SessionStart and PostToolUse handlers, plus PreCompact only when Codex is the chosen self-improver, into `~/.codex/hooks.json`, preserving unrelated hooks and leaving `config.toml` alone.
- Saves private adapter settings and backups under `~/.orient/codex`.

It refuses conflicting real skill folders, foreign agent files, ambiguous managed sections, malformed hook configuration, and an active `AGENTS.override.md`. Resolve the reported conflict rather than overwriting another setup. Applying it twice makes no further changes.

## Personal guidance

Your existing Codex guidance can stay in `AGENTS.md`. If you want both tools to use an existing personal file as their source, supply it:

```bash
node adapters/codex/install.mjs --apply --verify --preferences /absolute/path/to/preferences.md
```

A global `CLAUDE.md` is also accepted when its only import is this clone's Orient overview. The adapter includes its personal text and expands the shared overview separately; it does not leave Claude's import syntax for Codex to interpret. Other imports require a plain preferences file. Personal text and local settings are never written into this public repo.

## Start and verify

Start a fresh Codex session and use `/hooks` to review and trust the Orient handlers. Codex requires this review for non-managed hooks; installing their files does not silently grant trust.

The SessionStart handler re-links newly added skills, refreshes generated agent files and the global section, and supplies the current overview and preferences as actual context. It refreshes on startup, resume, and compaction. Existing skill edits are visible through their links without copying anything. A conversation that already loaded a skill can still hold the earlier text; check changes in a fresh session.

Verify each part before claiming success:

1. Re-run `node adapters/codex/install.mjs --verify`. It should report that everything is current. Confirm the links resolve into this clone and `/skills` lists Orient.
2. In a new session, ask Codex which personal guidance and Orient overview it loaded. Confirm actual content, not just filenames. Ask it to use Execute for a small disposable task and Critique to check it; confirm their startup standards were loaded.
3. Confirm `/hooks` shows the handlers as trusted. Check startup refresh. When Claude is selected, confirm Codex has no Orient PreCompact handler and that directly calling an old handler starts no background work. When Codex is selected, test compaction with a disposable transcript. A configured hook that is skipped is not a working loop.
4. Run `node --test adapters/codex/install.test.mjs` and the existing Claude hook checks. The native core-protection proof is described below.

Do not claim these checks passed unless you actually ran them. No installed Claude file needs to change to add Codex.

## Background improvement

Only when Codex is selected, its PreCompact handler calls the existing `hooks/self-improve-trigger.mjs` in Codex mode. The trigger checks the saved choice before touching improvement state or starting a child. A stale Claude trigger does nothing when Codex is chosen, and a stale Codex trigger does nothing when Claude is chosen. Transcript slicing, offsets, weekly cleanup, and the run-log remain shared. The child is started with Codex and its own account authentication; no Claude token is copied or used.

The autonomous child ignores user execution settings and selects a restricted native permission profile. It can write skills and local evals, but `skills/orient` and the rest of the core remain read-only, including through shell commands. A configured brain is writable too. Apps, plugins, additional agents, and child hooks are disabled in that background run. The parent's permissions are not changed. Codex's startup files and the adapter itself remain outside its writable roots.

The child defaults to Codex's available model. `minerModel` in the private adapter settings is an optional explicit choice; there is no hard-coded OpenAI model tier to maintain in the shared skills. If the shell's `codex` launcher is broken or unavailable, set `ORIENT_CODEX_BIN` or pass `--codex-bin /absolute/path/to/codex` when installing. The adapter also checks the usual macOS app-bundled locations.

Test the write boundary with `codex sandbox -P orient_miner` using the same filesystem rules from `minerPermissions` in `self-improve.mjs`: a scratch skill edit must succeed and a write to the core must fail. Also inspect a headless child's effective permission profile; legacy `--sandbox` settings must not override it. Never replace this with unrestricted access to make a test pass.

Trigger log entries identify Claude or Codex; children are instructed to include the tool in their change summaries. Spawn failures and the child output are visible in `~/.orient/self-improve.log` and `~/.orient/codex/miner-output.jsonl`. Preserved transcript slices keep a failed run recoverable, as in the Claude loop.

## Usage observations

Claude's usage file continues to count explicit Skill-tool calls. Codex's PostToolUse observer records recognized successful direct `cat .../SKILL.md` reads in `~/.orient/skill-reads.codex.json`. This is deliberately a separate measurement: other read methods, startup preloads, and unreported exit statuses are not counted. A read does not prove the skill was followed, and zero observations do not mean it was unused. Claude's existing usage report is not presented as total cross-tool usage.

## Checks and references

```bash
node --test adapters/codex/install.test.mjs
bash hooks/wall-unit.sh
bash hooks/self-improve-unit.sh
bash hooks/skill-usage-unit.sh
```

The automated installer tests use a disposable `ORIENT_USER_HOME`; they do not repoint the user's home or authentication directory. Live Codex/Claude checks still need the corresponding installed and authenticated tool.

- [Global instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Linked skills](https://learn.chatgpt.com/docs/build-skills)
- [Custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Hooks and trust](https://learn.chatgpt.com/docs/hooks)
- [Filesystem permission profiles](https://learn.chatgpt.com/docs/permissions)
