# Orient adapters

Adapters map the portable Orient harness into a specific agent runtime.

Orient itself owns the neutral files:

- `core/` for always-on harness context and architecture state.
- `agents/` for agent system prompts.
- `skills/` for reusable instructions loaded on demand, plus their own supporting files.
- `hooks/` for event-bound behavior.
- `evals/` for test cases that prove prompt and skill changes.

An adapter should not define Orient. It should only install or expose these files to a runtime such as Claude Code.
