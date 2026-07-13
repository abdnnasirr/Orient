# Setting up Orient

You are a fresh Claude Code, and someone just asked you to install Orient. This file is your instructions. Follow it top to bottom, prove every step, then tell them plainly what you did.

## What Orient is (so you can explain it later)

Orient is a way of working inside Claude Code that understands a request before it builds. Instead of running with a guess, it thinks the request through with the person first, reflects their goal back in their own words until you both hold the same picture, then hands the build to fresh sub-agents and judges the result against that goal. Orient is also a self-improving system: a background agent turns each session into two things. One, sharper skills, where it creates new skills and edits its own. Two, durable notes that serve as a knowledge base, a second brain (in Obsidian, if they have it). The more it is used the better it gets: the less the person has to explain, and the more efficient their work becomes. It is all plain markdown and plain Node, no dependencies.

## The one rule: install globally, never into this project

Orient is global. It installs into `~/.claude` (agents and skills) and the user's global `~/.claude/CLAUDE.md`. It must work in every session on this machine, not just this one.

If this session is running inside a project or a git repo, that changes nothing. **Still install globally.** Do not put anything under the current project's `.claude/`, and do not add the import line to a project `CLAUDE.md`. A fresh agent's instinct is to scope to the repo it is sitting in. That is the one known way this install goes wrong. Global, every time.

## Steps

### 1. Clone the repo (skip if it is already here)

The installer creates symlinks that point back into the cloned repo, so it needs a permanent home, not a temp dir.

- If this session is already running inside the Orient repo, use it where it is. Run `pwd` to get the absolute path and skip to step 2.
- Otherwise clone it to a stable location like `~/Orient`:

```bash
git clone https://github.com/abdnnasirr/Orient ~/Orient
```

For the rest of this file, `REPO` means the absolute path to that clone (for example `/Users/you/Orient`).

### 2. Run the installer

Run it from the repo root. It links every agent and every skill into `~/.claude`. Dry-run first so you see what it will do, then apply. Never hand-create the symlinks; the script is the source of truth and it is safe to re-run (it refuses to clobber any real directory, only touches missing or existing symlinks).

```bash
cd REPO
node adapters/claude/install.mjs           # dry run: prints what it would link, changes nothing
node adapters/claude/install.mjs --apply    # links agents + skills into ~/.claude
```

The installer links into `~/.claude` no matter where you run it from, which is exactly the global scope you want.

### 3. Add the always-on line to the global CLAUDE.md

This one line is what makes Orient orient on every request. On `--apply` the installer prints the exact line for you. Append it to `~/.claude/CLAUDE.md` (the global file in the home directory, not any project's CLAUDE.md). Create the file if it does not exist. Do not overwrite what is already in it.

```
@REPO/core/orient-overview.md
```

Use the absolute `REPO` path, not a relative one.

### 4. Wire the hooks

Three hooks run the self-improving loop: a trigger that fires the background agent as a session compacts, a wall that keeps that agent off the core files, and a usage meter that records which skills get used so the library can be pruned instead of only grown. They live in `~/.claude/settings.json`.

Merge these entries into that file. If it already exists, keep everything in it and add these; if a `hooks` block or a `PreCompact` / `PreToolUse` array is already there, append to it rather than replacing it. Use the absolute `REPO` path in every command.

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          { "type": "command", "command": "node REPO/hooks/self-improve-trigger.mjs" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node REPO/hooks/core-wall.mjs" }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          { "type": "command", "command": "node REPO/hooks/skill-usage.mjs" }
        ]
      }
    ]
  }
}
```

The `PreCompact` entry is the load-bearing one; it is how the loop fires at all. The `Skill` entry is the usage meter: it records which skills get used so the weekly skill-library pass can surface the unused ones. `hooks/README.md` in the repo is the full reference if you need it.

### 5. Config (one optional file)

Config lives at `~/.orient/config.json`. It is optional. If you set anything, create the directory and file:

Before you ask the human anything, look for what is already true on this machine. Check the common Obsidian locations (`~/Obsidian`, `~/Documents/Obsidian`, `~/Library/Mobile Documents/iCloud~md~obsidian/Documents`) and any obvious notes folder. Never ask a question you could have answered yourself; what you find shapes the one question in the handoff below.

- **`brain`** (ask the human, see the handoff below): a path to a markdown notes folder or Obsidian vault. Set it, and the self-improver files what it learns there. Leave it unset and brain writes are skipped.
- **`oauthToken`** (optional, do not block on it): a long-lived token from `claude setup-token`. The background self-improver runs detached and cannot borrow this session's login, so without this token its runs may fail to authenticate. Getting the token is the human's own action (it is a credential; do not create or handle it for them). It can be added later, so do not hold up the install waiting on it. Mention it once and move on.

```json
{ "brain": "/path/to/vault", "oauthToken": "..." }
```

## Verify before you declare success

An install that fails silently is worse than a script that fails loudly. Prove each of these and read the output. If any check fails, fix it before you tell the human it is done.

1. **Every symlink resolves.** Run `ls -l ~/.claude/agents` and `ls -l ~/.claude/skills`. Confirm `execute.md`, `critique.md`, `self-improve.md` and the skill folders (`orient`, `build`, and the rest) point into `REPO`, and that none are broken. The clean proof: re-run `node REPO/adapters/claude/install.mjs` (dry run) and confirm the Orient entries all read as already linked, with nothing left to link.
2. **The import path exists on disk.** Confirm the `@REPO/core/orient-overview.md` line is present in `~/.claude/CLAUDE.md`, and that the file it points at actually exists: `test -f REPO/core/orient-overview.md && echo ok`.
3. **The hooks are wired and their scripts resolve.** Confirm `~/.claude/settings.json` contains all three hook entries, and that all three scripts exist: `test -f REPO/hooks/self-improve-trigger.mjs && test -f REPO/hooks/core-wall.mjs && test -f REPO/hooks/skill-usage.mjs && echo ok`.

## Tell them what you set up

Now hand it back in plain words. No technical terms: do not say symlinks, settings files, or hooks. Give them the system in its three parts, briefly, so they feel what just changed:

> Orient is installed and working. Three things are different now.
>
> **It understands you before it builds.** Your request starts a real conversation: I read what is actually there, then say your goal back to you in your own words until we both hold the same picture. No more confidently building the wrong thing.
>
> **It orchestrates the build.** Real work goes to fresh agents: one builds, a separate one judges the result against your goal before you ever see it. You approve at the end; that call is always yours.
>
> **It improves itself.** A background agent learns from every session, both the moments you push back and the moments things go well. It sharpens its own skills and keeps what it learns, so the more you use it, the less you have to explain.

Then the brain, shaped by what you found in step 5. This is the one part that touches their own files, so say that plainly rather than letting them find out:

- **If you found a vault:** "I found your Obsidian vault at `<path>`. Orient can keep what it learns there as plain notes: it will create and edit notes inside it, and tidy them over time. Want that? I can explain more first, or you can turn it on later."
- **If you found nothing:** "Orient keeps what it learns about you and your work as plain notes you own. I can create that folder for you now (it works with Obsidian, if you ever use it), or you can skip it."

Either way, close with: everything else configures itself as you use it, so there is nothing else to set up.

If they hesitate or ask questions, explain plainly and let them decide later; nothing breaks without the brain. Do not turn this into a setup interview. The one question above is the whole of it. A questionnaire is the opposite of what Orient is.
