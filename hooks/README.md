# Hooks

Three hooks run the harness's self-improving loop: a trigger that fires the self-improving agent as a session compacts, a wall that keeps that agent off the core, and a usage meter that records which skills actually get used so the library can be pruned instead of only grown. Wire the trigger and the meter into your settings; the trigger wires the wall into every run it spawns.

## The three hooks

- **`core-wall.mjs` — the guard.** A PreToolUse hook (matcher `Edit|Write|MultiEdit`) that blocks any edit to a core file — orient, execute, critique, the self-improver's own prompt, the role, the global CLAUDE.md, and the wall itself — by exiting 2. It fail-closes: an input it cannot parse is blocked, because a wall that fails open is no wall. It is a hook rather than a `permissions.deny` rule because the headless run uses `bypassPermissions`, which skips deny rules but still honors a PreToolUse block (proven by `wall-proof.sh`).
- **`self-improve-trigger.mjs` — the trigger.** A PreCompact hook that fires the self-improving agent once per compaction. It slices only the transcript bytes that are new since it last ran, then spawns a detached headless run of the `self-improve` agent on that slice — with the wall already wired in via a generated `--settings` file, so the spawned child is guarded without you wiring the wall yourself. It also fires the weekly `clean-skills` and `clean-the-brain` passes on their own stamps. It fail-opens: any fault exits 0, so it can never veto your compaction.
- **`skill-usage.mjs` — the meter.** A PreToolUse hook (matcher `Skill`) that records every skill invocation in `~/.orient/skill-usage.json` (`use_count`, `first_used_at`, `last_used_at` per skill). The weekly `clean-skills` pass reads it to surface skills that have gone unused. It only observes, so it fail-opens all the way: any fault, or a call it cannot read, exits 0 silently and never blocks or slows the tool call.

## Wiring

Add these to `.claude/settings.json` (project or `~/.claude/settings.json`), with the paths pointing at your clone:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          { "type": "command", "command": "node /path/to/orient/hooks/self-improve-trigger.mjs" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node /path/to/orient/hooks/core-wall.mjs" }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          { "type": "command", "command": "node /path/to/orient/hooks/skill-usage.mjs" }
        ]
      }
    ]
  }
}
```

The PreCompact entry is the one that matters: it is how the loop fires at all. The wall PreToolUse entry is optional defense for your own sessions — the trigger already generates it for every child it spawns. The `skill-usage` PreToolUse entry is what feeds the weekly `clean-skills` pass; without it the usage log stays empty and every skill reads as unused.

## Config

`~/.orient/config.json` is a plain JSON file the trigger reads; both keys are optional:

- **`brain`** — path to a markdown vault. Set, it gates on the brain work: the agent files durable knowledge there and cleans it weekly. Unset, all brain writes are skipped.
- **`oauthToken`** — a long-lived token from `claude setup-token`. The detached child cannot reuse the live session's auth, so without this it may fail to authenticate.

```json
{ "brain": "/path/to/your/vault", "oauthToken": "..." }
```

Every fire and skip leaves a dated line in `~/.orient/self-improve.log`, so you can see the loop working.

## Proof

- `wall-unit.sh` — deterministic, model-free: feeds the wall the exact stdin a PreToolUse hook receives and asserts every verdict (20 cases).
- `self-improve-unit.sh` — same discipline for the trigger's slicing, offset, and fail-open behavior.
- `skill-usage-unit.sh` — same discipline for the usage meter: counts increment, timestamps are written, and malformed or non-Skill input exits 0 without corrupting the log.
- `wall-proof.sh` — the live leg: spawns a real headless child and shows the block on disk.
