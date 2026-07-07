# Claude adapter

Claude Code uses its own surfaces: `CLAUDE.md`, `.claude/settings.json`, `~/.claude/agents`, and `~/.claude/skills`.

This adapter is the place for that mapping. It should eventually:

- expose Orient agents from `agents/`;
- expose Orient skills from `skills/`, including each skill's supporting files;
- wire only the hooks that are event-bound;
- leave the neutral Orient files independent from Claude-specific paths.

The installer is dry-run by default. Run it with `--apply` only after reviewing the printed operations.
