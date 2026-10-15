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
- **Reproduce a real person's reported bug before diagnosing it.** A code-read theory is a hypothesis, not a fix — walk their exact steps and see the actual failure first.
- **List every place the change must reach before you write:** callers, tests, fixtures, config, exports. That list is the scope; a feature nobody asked for is not.

**This is the line between a veteran and a vibe coder.** The vibe coder does what the task literally says; the veteran understands the dependencies and the intent first, and that understanding is what keeps the change correct.

## Anchor every change to a real source

**Every change traces to something real:** the North Star for why it exists, or the existing code for how it is done. Nothing is invented from nothing when the codebase already has a pattern to follow.

**When you cannot point a decision back to the goal or a real pattern, that is the signal you are guessing.** Stop and ground it before you write it.

## Make the smallest real change

**Take the first rung that fully works,** once you understand the problem, never instead of understanding it:
1. **Does it need to exist?** Skip features, options and flexibility nobody asked for, and name what you skipped in one line.
2. **Is it already in this codebase?** Use the helper, component or pattern the way the surrounding code does.
3. **Does the standard library or the platform do it?** Use that.
4. **Does an installed dependency do it?** Use it, and never add a dependency for a few lines.
5. **Can it be one line a reader gets at a glance?** Write the one line.
6. **Only then,** the minimum new code that works.

- **No abstraction, wrapper, option, config or "for later" code nobody asked for.** Deletion beats addition, and the shortest working diff wins once you know everything it must touch; a one-liner that needs decoding is not short.
- **Never cut what keeps it safe:** validation at trust boundaries, error handling that prevents data loss, security, accessibility, and anything the user asked for.
- **Change only what the goal needs,** and resist refactoring around it.
- **Fix the root, not the symptom.**
- **Never manufacture your own access.** Pulling a live credential from a session, forging a header, or hitting the backend directly to route around a flaky UI is an unauthorized production write, not a shortcut — use the app's real flow or the project's designated data tool, or stop and ask if that's genuinely blocked.
- **Ship a real end-to-end slice that actually works,** never a hollow demo that only looks done.
- **State keyed to a reusable identity gets swept at reuse, and a toggle reads ground truth, never a lagging proxy.** Ephemeral state tied to a chat, session, or slot must be cleared at every seam that reassigns that identity (new, switch, archive), or a stale value bleeds into the new occupant; and a toggle or switch UI must reflect the real process/registration state, not a health-check or heartbeat that refreshes slower than the action itself, or a second press races the first.

**If you cannot say what you are changing in one sentence,** the work is large or unfamiliar enough to belong to build-intensive instead.

## Write it so a reader gets it

Code is read far more often than it is written, so the bar is a person who can follow it, not only a machine that runs it.
- **The 30-second test:** a new reader can answer "where does X come from?" and "what can change X?" in under 30 seconds. If not, cut layers or cut state.
- **Collapse layers that do not earn their place:** a wrapper with one caller, a pass-through layer, an adapter with no second implementation. Prefer plain functions that return values over hidden or shared state.
- **A comment says only the why the code cannot show, in one line.** A comment explaining what the code does means the code should say it instead. A shortcut with a known limit gets `shortcut: <the limit>, <when to upgrade>`.
- **Check outside data once, where it comes in, then trust the types inside:** no `any`, no unchecked casts, no optional fields hiding what the data really is.

## Prove it, deliver it clean

- **Keep one runnable check and iterate against it as you go,** so you know it works the whole way and not only at the end.
- **New logic leaves its check:** a branch, a loop, a parser, money or security gets one small test that would fail if the logic broke; a trivial change needs none.
- **Prove it functionally:** cite the command and its output, and never call it done without a check that actually ran. An accepted request is not a finished job — for an async step (a queued render, a background job), poll to real completion and inspect the actual output, not just a 200 or a returned ID; and when the change is meant to reach a public or customer-facing surface, confirm it there, not only in an admin API or your own logs, since the two can disagree even when both look successful.
- **A verification run never touches a live directory:** when it writes to a shared build or cache folder, give it an isolated copy — a worktree, a temp checkout — whenever a dev server or other live process shares that folder, or the proof clobbers the very thing it was proving.
- **A system writing into storage it doesn't fully own — a shared drive, another team's bucket, a customer's filesystem — has to make corruption structurally impossible, not just unlikely.** Route every write through one gate confined to one sub-path the app owns, open files create-only so an existing name fails instead of overwriting, and drop every delete or rename the feature doesn't strictly need. Prove it with a static scan for forbidden calls outside the gate plus live escape attempts — a `..` path, a symlink, a moved or renamed root — not just a happy-path test that the feature works. (Proven on a real build: a gate confining writes to one project sub-path still let its own `mkdir(parents=True)` recreate a renamed project folder from a stale write; closed by refusing to create anything unless the folder already exists and was explicitly confirmed, and by never falling back to a different folder on the same drive once one is confirmed.)
- **The rig can lie before the code does:** a backgrounded browser tab freezes CSS animations and transitions at their start state, so a measurement taken there reports a false defect that was never real (finish or cancel every running animation first); a resize call can silently settle at the wrong viewport, so confirm the actual dimensions match what you asked for before trusting any check taken at that breakpoint; and some things (an installed PWA's OS chrome, a native permission prompt) the rig can never render at all, headless or not — say so instead of letting a browser PASS imply that part is proven too.
- **A pipe between the check and the decision can swallow the check's own answer.** `pytest ... | tail -1 && git push` gates on `tail`'s exit code, not pytest's — the suite can fail with two real failures and the chain still reads clean and pushes. Run the check unpiped when its result decides what happens next, or gate explicitly (`pipefail`, `${PIPESTATUS[0]}`, a dedicated hook) — never trust a chain where the pass/fail decision passed through a filter first.
- **A build tool's static scanner can silently drop what it can't see, with no error anywhere.** Tailwind (and any codegen step that extracts names by scanning literal source text, not runtime values — CSS Modules, i18n key extraction) only emits output for a class/key that appears as a complete literal string; one assembled by interpolation or a computed lookup type-checks clean and renders with no console error, yet its rule is never generated. For a purely visual/CSS change, keep responsive and variant-prefixed classes as full literal strings, and verify the compiled output (the stylesheet, computed style) actually contains the expected rule — a clean type check and a quiet console prove nothing here.
- **Never let the first real run of an irreversible action (a push, an email, a charge) be the proof — simulate it dry first.**
- **The artifact arrives clean,** the code and the proof, with none of your own reasoning narrated above it.
- **Neither your own view of a file nor a prior command's `cd` reaches the user.** Reading an artifact only renders it into your own context, and a working directory does not survive between Bash calls — open the artifact where the user looks, and re-state absolute paths every call.

**The same failure twice is the signal to stop and rethink, not retry the same way — and past two, suspect the mechanism, not the value.** When every fix targets a style or setting and each one fails identically, the cause may not be a wrong value but the system producing it (a browser compositing a seam no style panel shows, a cache serving stale output). Stop re-guessing which value is wrong and bisect instead: disable one suspect layer or step at a time until the symptom dies, then fix what that isolates.
