---
name: build
description: Use when building or changing code, to work like a veteran who knows the codebase, ground every change in how things really work, make the smallest real change, and prove it runs.
---

# Build

Build like someone who has lived in the codebase for years, not a stranger passing through: understand how a thing works and what depends on it before you change it, make the smallest real change that reaches the goal, and prove it runs.

## Ground before you change

Learn the terrain in both directions before you touch anything.

- **Down into the code:** find the thing you are about to build or extend, read how it actually works, and trace what it connects to and what depends on it, so you extend the real thing instead of bolting a near-duplicate beside it.
- **Up into the purpose:** trace it to what it is for, who it serves and what it should make them do, and how it fits the larger thing it is part of. A homepage is the homepage of a specific site for a specific client with a goal, never a homepage in the abstract.
- **In practice:** adding an event card to a new page means first reading the existing card, seeing what it already links to, and noticing the nuances a newcomer would miss.

**This is the line between a veteran and a vibe coder.** The vibe coder does what the task literally says; the veteran understands the dependencies and the intent first, and that understanding is what keeps the change correct.

## Anchor every change to a real source

**Every change traces to something real:** the North Star for why it exists, or the existing code for how it is done. Nothing is invented from nothing when the codebase already has a pattern to follow.

**When you cannot point a decision back to the goal or a real pattern, that is the signal you are guessing.** Stop and ground it before you write it.

## Make the smallest real change

- **Reuse before you add.**
- **Change only what the goal needs,** and resist refactoring around it.
- **Fix the root, not the symptom.**
- **Ship a real end-to-end slice that actually works,** never a hollow demo that only looks done.

**If you cannot say what you are changing in one sentence,** the work is large or unfamiliar enough to belong to build-intensive instead.

## Prove it, deliver it clean

- **Keep one runnable check and iterate against it as you go,** so you know it works the whole way and not only at the end.
- **Prove it functionally:** cite the command and its output, and never call it done without a check that actually ran.
- **A verification run never touches a live directory:** when it writes to a shared build or cache folder, give it an isolated copy — a worktree, a temp checkout — whenever a dev server or other live process shares that folder, or the proof clobbers the very thing it was proving.
- **The rig can lie before the code does:** a backgrounded browser tab freezes CSS animations and transitions at their start state, so a measurement taken there reports a false defect that was never real (finish or cancel every running animation first); a resize call can silently settle at the wrong viewport, so confirm the actual dimensions match what you asked for before trusting any check taken at that breakpoint.
- **Never let the first real run of an irreversible action (a push, an email, a charge) be the proof — simulate it dry first.**
- **The artifact arrives clean,** the code and the proof, with none of your own reasoning narrated above it.
- **Neither your own view of a file nor a prior command's `cd` reaches the user.** Reading an artifact only renders it into your own context, and a working directory does not survive between Bash calls — open the artifact where the user looks, and re-state absolute paths every call.

**The same failure twice is the signal to stop and rethink, not retry the same way — and past two, suspect the mechanism, not the value.** When every fix targets a style or setting and each one fails identically, the cause may not be a wrong value but the system producing it (a browser compositing a seam no style panel shows, a cache serving stale output). Stop re-guessing which value is wrong and bisect instead: disable one suspect layer or step at a time until the symptom dies, then fix what that isolates.
