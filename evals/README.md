# Evals

Evals are the proof cases for prompt and skill changes.

Each case is a real input plus a known-good target. When the self-improving agent edits a skill, it should test the current skill, the proposed edit, and the simplest viable variant against the relevant case. A change ships only when it beats the current behavior without regression.

This is the GEPA idea in Orient, kept small: use real cases, read the failure, change the prompt, run again, and keep only the version that wins. The eval is not a formality; it is the gate that lets self-improvement run without asking the user every time.

Do not make evals for everything. Use them when the artifact has repeatable behavior: a skill, a system prompt, or a writing pattern with a known-good target. Skip them for cleanup, folder moves, one-off architecture calls, and anything the user is actively co-writing.

## Public and Local

The public repo ships this method, not the user's gold cases.

Actual eval case files in this folder are gitignored by default. Mine them from real transcripts and accepted outputs for the local user. They teach Orient a user's taste; they should not ship as the framework's public truth.

Use this shape:

```text
evals/<skill-or-domain>/<case-slug>.input.md
evals/<skill-or-domain>/<case-slug>.gold.md
evals/<skill-or-domain>/<case-slug>.notes.md
```

- `input.md`: the rough prompt, transcript slice, or scenario.
- `gold.md`: the target output or target behavior.
- `notes.md`: why this case matters and what failure it catches.

Do not invent gold cases from taste in the moment. Mine them from real Claude Code JSONL transcripts, user corrections, or final accepted artifacts.
