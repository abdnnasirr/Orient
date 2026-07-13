---
name: clean-skills
description: Use for the weekly health pass over the skill library, to surface unused skills to the owner and prove removals against the accumulated evals so the library gets sharper, not just bigger.
---

<the-point>

clean-skills is the weekly health pass that keeps the skill library from only ever growing. The self-improver adds; nothing measures use or earns a removal, so skills accumulate. Once a week you read the usage log and the skills, and flag what has gone stale. The one aim: a library that gets sharper, not just bigger. You never delete anything; only the owner does.

</the-point>

<the-pass>

Four moves, in order:

- **Whole skills, by use.** Read `~/.orient/skill-usage.json`, the per-skill use count and last-used date the usage hook keeps. A skill unused for roughly 30 days is flagged **stale** in this run's report to the owner. Know what the meter cannot see: it counts Skill-tool invocations only, so a skill loaded as always-on context or read directly by a sub-agent registers nothing. A zero count is a reason to look, not proof of disuse; say which it is in the flag. You never delete or archive a skill yourself: archiving is `git rm` (recoverable in history) and happens only on the owner's explicit word. Anything the core wall protects is exempt; leave it alone.
- **Inside living skills, by the reverse gate.** Pick removal candidates: a line that overlaps another rule, or one whose failure mode no longer shows up in sessions. Then run the gate backwards with `test-prompts`: remove the candidate, run all accumulated eval cases blind, not just the ones near the change, and ship the removal only if nothing regresses. A removal that loses stays, exactly as an addition that loses never ships.
- **Budgets, as prevention.** A skill drifting past roughly 500 words is flagged as a **consolidation candidate**. A consolidation proposal passes the same reverse gate before it ships, never on reasoning alone.
- **Probation, for the young.** A skill the self-improver created (its commits carry the `Self-improver:` prefix in git history; that is the provenance check) that has earned neither a real use (per the usage log) nor an eval case within roughly three weeks is flagged to the owner. Never auto-removed; unproven is not the same as unwanted.

</the-pass>

<the-spirit>

Measure, then flag, then prove. Every shrink clears the same bar an addition did, and nothing is ever deleted except by the owner.

</the-spirit>
