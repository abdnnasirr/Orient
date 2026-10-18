---
name: technical-critique
description: Use when reviewing new or changed code, including Critique's technical pass, to verify correctness and judge whether the design makes the system easier to understand and maintain. For an existing-codebase audit, use code-audit.
---

# Technical critique

This is the technical pass of a critique: how to read a build's code and find what is actually wrong, without becoming a nitpicker. The order is fixed. Run the checks before you judge, hunt the highest-stakes failures first, then the bloat, and rate what you find so the one bug that matters is never buried. To assess an existing codebase with no change to judge, use code-audit instead.

## Run the checks before you judge

Anything you can decide pass or fail without reading the code is a check, not an opinion. Run it first, and read the output yourself.

- **The project's own checks, whatever they are:** its tests, its types, its lint, and for a screen its design-check. Run what the project has, never the claim that it passes.
- **A screen's design-check is a screenshot beside the reference, not the code that produced it.** Render the real page and hold it next to the mockup, the prior design, or the original being ported. Tokens used and code that compiles prove nothing about how it looks, and a reference route can sit stale or broken the whole time while every code check still passes clean.
- **The proof can lie before the code does, so check how it was taken.** `pytest ... | tail -1 && git push` gates on `tail`'s exit code, not pytest's, so a piped check can fail and still read clean; rerun it unpiped. A Tailwind class built by interpolation type-checks clean and is never generated; look for the rule in the compiled stylesheet or the computed style. A backgrounded browser tab freezes CSS animations at their start state, so a screenshot there can show a defect that isn't real; finish or cancel the animations before you call it. A resize can settle at the wrong viewport; confirm the dimensions. Something the rig can never render (an installed PWA's OS chrome, a native permission prompt) is unverified, not passed.
- **Then judge only the slice a check cannot reach:** is it correct, does it fit, does it hold up. That is what reading the code is for. Passing checks still miss a wrong assumption, an untested interaction, or an assertion that tests the wrong thing.

## Hunt the highest-stakes failures first

Read every changed line. Before you judge it, know what the code must make true: who uses it, how data moves through it, the rules that must hold, the states it can be in, and who owns each decision. These are classes of failure, not a checklist to tick, so they hold for any language or build: read for the ones that apply, worst first, because a wrong answer matters more than a wrong name.

- **Fit:** it extends what was there, instead of bolting a near-duplicate beside it. Feature logic stays in the layer that owns it; flag it when it leaks into a shared or general-purpose path.
- **Correctness:** it does the right thing in the normal case. Walk one concrete input through the real flow to see it.
- **Edges:** empty, null, zero, one, many, the boundary, the off-by-one.
- **Tail-drop:** an order-plus-limit query can silently exclude exactly the rows a feature exists to surface. An "upcoming" or "further out" list sorted ascending with a limit shows only the soonest N and drops everything past it, the opposite of the ask, with no error to catch it. An empty result is not proof that nothing exists.
- **Failure:** errors are caught, not swallowed, and nothing is left half-done on a throw. Related updates either all land or none do.
- **False confidence:** a caught error that renders as a valid empty or success state (a failed drafts read showing "0 drafts") is worse than an uncaught one. It looks verified, not broken, and can recreate the exact bug the build exists to fix inside its own new error path.
- **Shared state:** races and ordering, anything two things touch at once: who owns it, what order it lands in, and what a retry does to it. A toggle that reads a heartbeat or health-check slower than the action lets a second press race the first. State keyed to a chat, session, or slot that is not cleared at new, switch, and archive bleeds into the next occupant.
- **Cost:** independent work run one after another for no reason, or parallel work that never earned its complexity; the same query run inside a loop; growth with no bound; an expensive path where it actually runs. Judge it against the load this system really serves, and do not accept a claimed speedup nobody measured.
- **Trust:** untrusted input is checked where it crosses into trusted code, and nothing secret is logged or exposed. A write into storage the feature doesn't own goes through one gate, create-only, and a `..` path, a symlink, or a renamed root cannot escape it.
- **Regressions:** what worked before still works. Grep the callers of every changed function, since a change can break code it never touches. That includes how developers run and build it: a moved secret, a renamed env var, a changed port, a newly required script. And a feature meant to sit behind a flag or an internal-only check must not leak past it.
- **Coverage:** for a port or rebuild, everything in the surface being replaced actually moved, not just the pages that got attention first, with the rest left as untouched old chrome wearing a "done" label.
- **Tests:** they would actually fail if the code broke, not just pass. A test that pins how the functions are arranged instead of what they do proves little, and a regression test should fail on the original bug.
- **Cited evidence:** a quote or citation about a source (a log line, a spec, a prior result) can be fabricated inside the code itself, not just in a chat reply: a docstring, a comment, or a test's own assertion. Grep the exact string against the real source before accepting it. A test asserting a citation that appears nowhere in the log it claims is the highest-risk shape, since it's built to look like proof and can pass silently forever.

A line you still cannot follow after reading what it calls is a defect, not your failure.

## Then hunt the bloat

Working is not enough: code that runs but leaves the codebase harder to read fails a standard the user holds. A clear case below is a Defect; one that is only your preference is a Nit. For a Defect, name what got harder to read or change and the simpler shape that fixes it, and make sure that simpler shape keeps every safety check and behavior people rely on.
- **Code judo:** a reframe that makes whole branches, helpers or layers disappear. Push to delete complexity, not to move it around; spreading the same complexity across more files is not simpler. Code that looks alike can carry different rules, so a merge has to keep those differences.
- **Spaghetti growth:** new special-case if-statements or one-off flags scattered through an existing flow mean the design is missing a piece, often a model of the states the data can really be in, which makes the scattered checks disappear. Two booleans that must agree are the same sign; derive one from the other.
- **Layers that do not earn their place:** a wrapper with one caller, a pass-through helper, an abstraction with one use. Also a module built around a sequence of steps (load, validate, transform, save) instead of the thing it knows about, which repeats the same rules in every step; and a broad interface that hides little, so a reader must learn both the surface and the implementation.
- **Dead weight:** code, options or config built for a need that is not here yet, and a dependency that costs more than it does. Before calling code unused, trace it through callers, tests, config, generated entry points and dynamic lookups. The old API left beside the new one after a migration counts.
- **Muddy types:** casts, `any`, or optional fields hiding what the data really is.
- **Comments doing the code's job:** a comment explaining what the code does, instead of why.
- **Giant files:** a change that grows a file past what a reader can hold, one file now doing several jobs, should split it along its seams first. Past roughly 1,000 lines is the usual sign.
- **The 30-second test:** a reader cannot find, in under 30 seconds, where a value comes from and what can change it.
- **A recurring mistake guarded only by a reminder:** when the same failure keeps coming back, the fix is the smallest type, constraint, test, or lint rule that prevents it, never a new framework and never a rule for taste.

## Judge the change, not the repo

Start from the goal and the actual diff, not the builder's summary of it. A failure that was already there is not this build's defect; one the change introduced is, so compare with the state before the change when you need to tell them apart. Judge the effect of the change against the bar Execute built to: ground before changing, reuse before adding, the smallest real change, fix the root, a real end-to-end slice, and for a screen no hardcoded values and none of the generic tells. A shortcut marked `shortcut: <the limit>, <when to upgrade>` and used inside its stated limit is a choice, not a defect. Report what you find; never fix it silently yourself. Breakage the author intended is not a finding, unless they likely missed its full reach or it looks like more than a mistake.

## Rate it, worst first

- **Blocker:** fails the North Star or breaks at runtime. Blocks.
- **Defect:** a real standard above is broken. Blocks.
- **Nit:** your own taste. Advisory, never blocks.

Say each finding in plain English: what the code does, what goes wrong, and what it costs if left, with the file, the line, and the evidence the fixer needs to act. Fail only on a Blocker or a Defect, and order the verdict worst first, so the one bug that matters is never buried under nits. Fold symptoms of one cause into one finding. Report what earns attention with no target count and no padding, and never drop a real finding to keep the list short.

State only what you verified. An unconfirmed cause is not a Blocker or a Defect, it's a flagged unknown, since a guess presented as fact sends the fixer chasing a mechanism that was never broken. Say whether you saw it happen at runtime or traced it through the source. Confirm a cause far enough to back the finding, and never leave it hanging on a part you could have opened yourself. When evidence is missing, say what is unknown and what would settle it, never a confidence percentage. End with what you checked and what you could not.

Reporting to the user, carry the meaning in plain words and keep the technical evidence with the finding it supports. Reporting to the orchestrator, give the exact locations and the proof the next fix needs.

## Do not flag

These turn a judge into noise, so leave them.

- **Style a linter handles,** or "I would write it differently."
- **Risks with no real path to happen here.** A correctness finding needs a real path to failure, and scale is judged against the load this system serves; not every project is a service for millions.
- **How Execute got there:** judge the artifact, never the path.
- **Anything that neither moves the build toward the North Star nor fixes a real break.**
