---
name: code-audit
description: Use when asked to assess an existing codebase or part of one for correctness, unnecessary complexity, maintainability, or improvement priorities, including audits without a recent diff. Explain the system and evidence in plain language; report rather than implement changes.
---

# Code audit

Help the owner understand whether the code serves its purpose, where it is needlessly hard to follow or unsafe, and what is worth changing. The result is an understanding they can use to decide, not a catalogue of functions or a quota of things to fix. Three moves: find the system's shape, hunt what deserves attention in a fixed order, and give the owner a picture they can act on.

## Find the system's shape

Read the real code and what sits around it: what it is for, who uses it, how it runs, how data moves through it, and the checks it already has. Start from the area the owner asked about; if none is named, take the whole repository. Existing problems are in scope even with no diff.

- **Hold it in one frame.** Use the `map` skill so the owner can follow the whole. The frame follows how the system serves its purpose: each part has one home, a finding sits under the part it affects, and a cause that runs across parts is explained once where it belongs, with its effects pointing back to it. When new evidence changes the picture, reshape the frame instead of adding another bucket.
- **Know what the code must make true:** the rules that must hold, the states the data can be in, and who owns each decision. Those are what every finding is judged against.
- **Go deep where a mistake costs most.** Trace the important flows through what they depend on. Find the real load before calling a design too small or too elaborate; not every project is a service for millions. Say what you read and what you assumed; a sample of a large system is not proof about all of it.

## Hunt what deserves attention

The audit changes no code. The order is fixed: run the checks before you judge, hunt the highest-stakes failures first, then the bloat, then weigh what you found.

**Run the checks first.** Anything you can decide pass or fail without reading the code is a check, not an opinion: the project's tests, its types, its lint, and for a screen its design-check. Run them and read the output yourself, never the claim that they pass. Run nothing that could touch shared data or a running system; use an isolated copy (a worktree, a temp checkout) instead of a live directory.
- **A screen's design-check is a screenshot beside the reference, not the code that produced it.** Hold the real render next to the mockup, the prior design, or the original being ported. Tokens used and code that compiles prove nothing about how it looks, and a reference route can sit stale or broken the whole time while every code check still passes clean.
- **The proof can lie before the code does.** `pytest ... | tail -1 && git push` gates on `tail`'s exit code, not pytest's, so a piped check can fail and still read clean. A Tailwind class built by interpolation type-checks clean and is never generated; look for the rule in the compiled stylesheet. A backgrounded browser tab freezes CSS animations at their start state, so a screenshot there can show a defect that isn't real. Something the rig can never render (an installed PWA's OS chrome, a native permission prompt) is unverified, not passed.
- **Passing checks still miss a wrong assumption,** an untested interaction, or an assertion that tests the wrong thing. Reading the code is for that slice.

**Then hunt the highest-stakes failures.** These are classes of failure, not a checklist to tick: read for the ones that apply, worst first, because a wrong answer matters more than a wrong name.
- **Fit:** a near-duplicate bolted beside the real thing instead of extending it. Feature logic that has leaked into a shared or general-purpose path belongs here too.
- **Correctness:** it does the right thing in the normal case. Walk one concrete input through the real flow to see it.
- **Edges:** empty, null, zero, one, many, the boundary, the off-by-one.
- **Tail-drop:** an order-plus-limit query can silently exclude exactly the rows a feature exists to surface. An "upcoming" list sorted ascending with a limit shows only the soonest N and drops everything past it, with no error to catch it. An empty result is not proof that nothing exists.
- **Failure:** errors are caught, not swallowed, and nothing is left half-done on a throw. Related updates either all land or none do.
- **False confidence:** a caught error that renders as a valid empty or success state (a failed drafts read showing "0 drafts") is worse than an uncaught one. It looks verified, not broken, and can hide the exact bug someone is hunting.
- **Shared state:** races and ordering, anything two things touch at once: who owns it, what order it lands in, and what a retry does to it. A toggle that reads a heartbeat or health-check slower than the action lets a second press race the first. State keyed to a chat, session, or slot that is not cleared at new, switch, and archive bleeds into the next occupant.
- **Cost:** independent work run one after another for no reason, or parallel work that never earned its complexity; the same query run inside a loop; growth with no bound; an expensive path where it actually runs. Do not claim a speedup you have not measured.
- **Trust:** untrusted input is checked where it crosses into trusted code, and nothing secret is logged or exposed. A write into storage the system doesn't own goes through one gate, create-only, and a `..` path, a symlink, or a renamed root cannot escape it.
- **Contracts:** grep the callers before calling a function safe to change or remove, since what people rely on lives in code that never mentions the problem. Include how developers run and build it (secret locations, env var names, ports, required scripts) and anything meant to stay behind a flag or an internal-only check.
- **Coverage:** a port or rebuild where only the pages that got attention first actually moved, with the rest left as untouched old chrome wearing a "done" label.
- **Tests:** they would actually fail if the code broke, not just pass. A test that pins how the functions are arranged instead of what they do proves little.
- **Cited evidence:** a quote or citation about a source (a log line, a spec, a prior result) can be fabricated inside the code itself: a docstring, a comment, or a test's own assertion. Grep the exact string against the real source before accepting it. A test asserting a citation that appears nowhere in the log it claims is the highest-risk shape, since it's built to look like proof and can pass silently forever.

A line you still cannot follow after reading what it calls is a defect, not your failure.

**Then hunt the bloat.** Working is not enough: code that runs but leaves the codebase harder to read is a real finding when you can name what got harder and the simpler shape that fixes it; one that is only your preference is not.
- **Code judo:** a reframe that makes whole branches, helpers or layers disappear. Delete complexity, don't move it around; spreading the same complexity across more files is not simpler. Code that looks alike can carry different rules, so a merge has to keep those differences.
- **Spaghetti growth:** special-case if-statements or one-off flags scattered through a flow mean the design is missing a piece, often a model of the states the data can really be in, which makes the scattered checks disappear.
- **Layers that do not earn their place:** a wrapper with one caller, a pass-through helper, an abstraction with one use. Also a module built around a sequence of steps (load, validate, transform, save) instead of the thing it knows about, which repeats the same rules in every step; and a broad interface that hides little, so a reader must learn both the surface and the implementation.
- **Dead weight:** code, options or config built for a need that never came, and a dependency that costs more than it does. Before calling code unused, trace it through callers, tests, config, generated entry points and dynamic lookups. The old API left beside the new one after a migration counts.
- **Muddy types:** casts, `any`, or optional fields hiding what the data really is.
- **Comments doing the code's job:** a comment explaining what the code does, instead of why. A shortcut marked `shortcut: <the limit>, <when to upgrade>` and used inside its stated limit is a choice, not debt.
- **Giant files:** a file grown past what a reader can hold in their head, one file doing several jobs, should be split along its seams. Past roughly 1,000 lines is the usual sign.
- **The 30-second test:** a reader cannot find, in under 30 seconds, where a value comes from and what can change it.
- **A recurring mistake guarded only by a reminder:** when the same failure keeps coming back, the fix is the smallest type, constraint, test, or lint rule that prevents it, never a new framework and never a rule for taste.
- **Off the build bar:** code that was never grounded, added beside a helper it should have reused, patched at the symptom instead of the root, or left as a hollow demo instead of a real end-to-end slice; for a screen, hardcoded values and the generic tells.

**Then weigh it.** Sort each finding into needs fixing (a real path to failure, or a named burden with a simpler shape that fixes it), could help, or preference; preference stays out. Leave out style a linter handles, "I would write it differently," risks with no real path to happen here, and how the code got this way. Recommend a change only where its benefit earns its cost and risk, and keep every safety check and behavior people rely on unless changing it is the goal. Name the simplification and why it helps; the build itself is separate work the owner authorizes. Finding nothing consequential is a valid result.

**State only what you verified.** Say whether you saw it happen at runtime or traced it through the source. Confirm a cause far enough to back the finding, and never leave it hanging on a part you could have opened yourself. An unconfirmed cause is a flagged unknown, not a finding: say what is missing and what would settle it, never a confidence percentage.

## Give the owner a picture they can act on

Lead with the overall assessment and the few ideas needed to understand it, the whole before its parts. In plain words, connect what each part does, what the evidence shows, and what would get better if it changed. Code names, commands, and line numbers stay with the evidence, so the owner never has to decode them to get the point.

- **Worst first.** Fold symptoms of one cause into one finding, keep what needs fixing apart from what could help, and make the highest-impact next move obvious.
- **No target count and no padding,** and never drop a real finding to keep the list short. If the detail runs long, keep it beneath the short explanation without burying anything that matters.
- **Say what you did not check** wherever it limits the assessment.
- **Draw only what prose can't carry.** A small diagram earns its place when seeing a relationship explains it faster than words. When the request needs a page, deck, or visual report, use `page` to show the map instead of inventing another way to present it.
