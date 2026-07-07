---
name: test-prompts
description: Use before shipping any prompt, skill, or doc edit to prove it works instead of trusting your reasoning; makes candidates, judges them against eval cases, keeps the simplest that wins.
---

# Test prompts

**The pair to write-prompts:** that one drafts the artifact, this one validates it before it ships. The discipline is one GEPA-shaped move repeated: run the case, read the failure, mutate the prompt, and keep the simplest candidate that wins.

**Never ship on reasoning alone.** Reasoning tells you a line should help; only a run against cases tells you it does.

## Eval cases

**Cases live in `evals/<thing>/`:** a real human input paired with the gold (the human-written target) or the target behavior (the concern the artifact must change). Judge against these, never your own taste in the moment.

**Score every candidate against all accumulated cases,** not just the newest, so a gain on one case cannot silently regress another.

**A skill mined from one session needs more than its origin case.** Add out-of-domain cases too, not just the case it was cut from, or an overfit, hardcoded skill passes by construction.

**Do not eval everything.** Use evals for repeatable behavior: skills, system prompts, and documents that should produce a recognizable kind of output. Do not create evals for file moves, cleanup, one-off judgment, or writing the README with the user in the loop.

## Pick the mode

The loop runs in one of three modes. Pick by what you are validating.

**Reproduce — for a writer skill:** can it turn rough notes into the human gold?
1. Generate the artifact from the notes.
2. Judge it against the gold, and name the gap in plain words.
3. Mutate the skill to close that gap, then regenerate.
4. Keep the best across cases.
Do not stop at the first version that reads well. The gold is the bar, and the gap to it is the only signal that earns a change.

**Behavior — for an artifact meant to change how a model acts:** does it, on the real scenarios it targets?
- **Run each scenario twice,** once with the artifact loaded and once without, and judge both against the concern.
- **Keep the artifact only when it clearly beats the bare baseline.** One that scores the same with and without it is dead weight, no matter how sound it reads.
- **This needs a genuinely blind baseline.** If the bare run already carries the knowledge through the model's training or the ambient files it loads, both runs pass and the test proves nothing.
- **So behavior-test only what is genuinely novel to the agent.** An always-on worldview file, whose worth is correctness and clarity rather than a behavioral delta, is validated instead by Reproduce against the human gold and the human's lock.

**Edit — for a proposed change to something live:** does it beat what is already there?
- **Draw the target failure** from its eval case in `evals/<thing>/`.
- **Put three in the ring on it:** the current version, the proposed change, and a simpler variant of that change.
- **Keep the simplest one that beats current.** This is the over-engineering check, and the core of the mode: never a longer line for a gain a shorter line already gets, and never a change at all when current already wins.

## The verdict

**Output one verdict, not a transcript.** Name what wins and at what length, then the change to keep, or "no change, the current already wins."

**A passing verdict cites the case it beat.** If nothing beats current, that is the result, and shipping the current version is the win.
