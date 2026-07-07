---
name: build-intensive
description: Use when a build is large, layered, or intent-critical and being thorough beats being fast: a big system or framework, a rebuild, work where getting it wrong is expensive, or any build whose answer is not yet known and must be found. Runs the build as a research process that grounds against the best existing solutions, writes its own dependency-ordered phases, and uncovers the answer through the work instead of being handed it.
---

# Build intensive

**The build is a research process, and the process produces the answer.** You do not start knowing the solution. You uncover it by writing your own phases, grounding each against the best work that already exists, and proving it as you go.

**Reach for this** when the answer is not yet known and the work is large enough that finding it well matters more than finding it fast. Normal build goes straight from a clear plan in one pass; this does not.

## Uncover the answer through the work

**You are not handed the solution; you arrive at it.** Phase by phase, each one teaching the next.

- **A plan that pre-decides every move produces a confident wrong answer.** A process that researches, builds, and critiques its way forward earns a right one.
- **Trust the process to find it,** never a script to dictate it.

## Carry little specifics, not none

The specifics are withheld on purpose: naming the answer up front skips the work that finds the better one.

- **Do not pre-name the solution.** The tool, the structure, the approach are each a candidate the process proves or replaces, never an assumption you build on.
- **An example that sets the bar is welcome; an answer to build on is not.** The test: would you happily discard it if the research pointed elsewhere?
- **Do not pre-list the research either.** The point is to find what matters through the work.
- **What you carry instead, like a lamp through the dark,** is the north star and the scenarios. Everything else, including in-the-moment suggestions, is a hypothesis to check, not a spec to implement.

## The inputs you carry

Three things, taken from the plan if one exists or straight from orient's live understanding, never a step-by-step script:

- **The north star** — what this is and why, in the user's words. The one line the whole build is held against.
- **The scenarios** — the end state as concrete examples of how it will be used: what good looks like, and where useful what it must not do. The lens every phase self-checks against.
- **The things to do** — the moves needed to get there and the intent behind each, never the exact steps.

**Ground these in the real source before you generate phases.** Read the user's own words and the thing you are building against, so the north star and the scenarios are real, not invented.

## Research: don't reinvent the wheel

**This is the heart of intensive mode.** Before you build a thing, find the best version of it that already exists and take the good from each.

- **Hunt the best-in-class reference for every piece.** Online research, articles, forums, other repos, the real code and kit you are touching. Name it and read it; never the model's memory.
- **The bar is the best tool for the thing.** Match it, then push past it.
- **Take the good from each source, not one whole answer.** You are assembling the best, not copying a template.
- **This runs inside every phase**, not once at the start: each phase grounds against its own reference before it builds.

## Write the phases, then run the loop

**Understanding precedes structure precedes build.** Map what is true before you design; let the shape settle before you build it.

**Lay the phases out by dependency** — the substrate before the surface, the schema before the reader. Each phase is a provable, revertible slice that stands on its own.

**When the build replaces or ports something that already exists, the first phase is an inventory, not a slice.** List every surface, route, and capability of the thing being replaced against the canonical source, and tag each with its fate — rebuild, reskin, keep-as-is, kill. Hold "done" to that full list, not to whichever surfaces got attention first: a rebuild that dazzles on three screens and leaves the rest as untouched old chrome is not done, it is unfinished with good marketing.

**A phase designs its own execution as its first act,** from everything earlier phases uncovered. The run gets smarter as it goes, so re-plan the rest whenever the work teaches you something.

**Before the first phase, commit the clean baseline,** so the whole run stays reversible to the start and to every phase boundary.

**Each phase then runs the same six-step loop — ground, build, self-check, critique, look, commit — in order:**

1. **Ground** against the best real reference, named and read.
2. **Build** the slice to that bar — real, end to end.
3. **Self-check** against the north star and the scenarios; run the deterministic checks.
4. **Critique** independently, fresh eyes, every claim citing a real source.
5. **Look** at it visually when it renders — view the page, capture a screenshot.
6. **Commit** the proven slice.

Then re-read the remaining phases in light of what this one taught, and run the next.

## Hold the line

**Push every phase the way a best-in-class practitioner would.** Never treat the current state as good enough.

- **Halt or flag, never degrade.** A phase that cannot pass cleanly after two honest tries halts and flags itself rather than lowering the bar to fake a pass. Quietly lowering the standard is the one real failure.
- **A wrong plan is information, not a setback.** When a phase reveals the plan itself is wrong, send it back.

**This is the depth you reach for** when the work is large, layered, or intent-critical and getting it wrong is expensive. The cost of the extra passes is exactly the point.
