---
name: technical-critique
description: Use for the technical pass of a critique (judging a build's code), to run the project's own checks first, hunt real defects in blast-radius order, and rate them by severity so a real bug never hides under a nit.
---

# Technical critique

This is the technical pass of a critique: how to read a build's code and find what is actually wrong, without becoming a nitpicker. The order is fixed. Run the checks before you judge, hunt the highest-stakes failures first, and rate what you find so the one bug that matters is never buried.

## Run the checks before you judge

Anything you can decide pass or fail without reading the code is a check, not an opinion. Run it first, and read the output yourself.

- **The project's own checks, whatever they are:** its tests, its types, its lint, and for a screen its design-check. Run what the project has, never the claim that it passes.
- **A screen's design-check is a screenshot beside the reference, not the code that produced it.** Render the real page and hold it next to the mockup, the prior design, or the original being ported — tokens used and code that compiles prove nothing about how it looks, and a reference route can sit stale or broken the whole time while every code check still passes clean.
- **Then judge only the slice a check cannot reach:** is it correct, does it fit, does it hold up. That is what reading the code is for.

## Hunt the highest-stakes failures first

Read every changed line. These are classes of failure, not a checklist to tick, so they hold for any language or build: read for the ones that apply, worst first, because a wrong answer matters more than a wrong name.

- **Fit:** it extends what was there, instead of bolting a near-duplicate beside it.
- **Correctness:** it does the right thing in the normal case.
- **Edges:** empty, null, zero, one, many, the boundary, the off-by-one.
- **Failure:** errors are caught, not swallowed, and nothing is left half-done on a throw.
- **Shared state:** races and ordering, anything two things touch at once.
- **Trust:** untrusted input is checked, and nothing secret is logged or exposed.
- **Regressions:** what worked before still works.
- **Coverage:** for a port or rebuild, everything in the surface being replaced actually moved — not just the pages that got attention first, with the rest left as untouched old chrome wearing a "done" label.
- **Tests:** they would actually fail if the code broke, not just pass.
- **Dead weight:** code built for a need that is not here yet.

A line you cannot follow is a defect, not your failure.

## Judge the change, not the repo

A failure that was already there is not this build's defect; one the change introduced is. Judge the effect of the change against the bar Execute built to: ground before changing, reuse before adding, the smallest real change, fix the root, a real end-to-end slice, and for a screen no hardcoded values and none of the generic tells.

## Rate it, worst first

- **Blocker:** fails the North Star or breaks at runtime. Blocks.
- **Defect:** a real standard above is broken. Blocks.
- **Nit:** your own taste. Advisory, never blocks.

Fail only on a Blocker or a Defect, and order the verdict worst first, so the one bug that matters is never buried under nits. State only what you verified — an unconfirmed cause is not a Blocker or a Defect, it's a flagged unknown, since a guess presented as fact sends the fixer chasing a mechanism that was never broken.

## Do not flag

These turn a judge into noise, so leave them.

- **Style a linter handles,** or "I would write it differently."
- **Risks with no real path to happen here.**
- **How Execute got there:** judge the artifact, never the path.
- **Anything that neither moves the build toward the North Star nor fixes a real break.**
