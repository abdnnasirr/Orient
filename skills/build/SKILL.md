---
name: build
description: Use when building, fixing, or refactoring code, whether in the main conversation or a delegate, to understand the system, choose the simplest design that serves the goal, and prove it works.
---

# Build

Build like someone who has lived in the codebase for years, not a stranger passing through: understand how a thing works and what depends on it before you change it, make the smallest real change that reaches the goal, and prove it runs.

## Ground before you change

Learn the terrain in both directions before you touch anything.

- **Down into the code:** find the thing you are about to build or extend, read how it actually works, and trace what it connects to and what depends on it, so you extend the real thing instead of bolting a near-duplicate beside it.
- **Up into the purpose:** trace it to what it is for, who it serves and what it should make them do, and how it fits the larger thing it is part of. A homepage is the homepage of a specific site for a specific client with a goal, never a homepage in the abstract.
- **In practice:** adding an event card to a new page means first reading the existing card, seeing what it already links to, and noticing the nuances a newcomer would miss.
- **Reproduce a real person's reported bug before diagnosing it.** A code-read theory is a hypothesis, not a fix: walk their exact steps and see the actual failure first.
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
- **Change only what the goal needs, and only where the task named.** A blocker that lives somewhere else, another repo, a live personal asset, a file a sibling agent is also editing, is reported or asked about, never fixed in passing, however small the write looks. Resist refactoring around it. The one exception is a rule already copied across the code: patching one more copy in place is wrong, and a wider change that pulls the rule into one home earns its scope when you can prove everything it touches still works. A new internal API lands with every caller moved and the old one deleted in the same change; a legacy path left beside the new one is dead weight.
- **Fix the root, not the symptom.**
- **Never manufacture your own access.** Pulling a live credential from a session, forging a header, or hitting the backend directly to route around a flaky UI is an unauthorized production write, not a shortcut. Use the app's real flow or the project's designated data tool, or stop and ask if that's genuinely blocked.
- **Ship a real end-to-end slice that actually works,** never a hollow demo that only looks done.
- **An error is caught, never swallowed, and never dressed up as success.** A failed drafts read that shows "0 drafts" looks verified instead of broken, and can recreate the very bug you are fixing inside its own error path. Let a failure show as a failure, and leave nothing half-done when something throws.
- **State has an owner and a lifetime, so state keyed to a reusable identity gets swept at reuse.** Ephemeral state tied to a chat, session, or slot must be cleared at every seam that reassigns that identity (new, switch, archive), or a stale value bleeds into the new occupant.
- **A toggle reads ground truth, never a lagging proxy.** A toggle or switch UI must reflect the real process or registration state, not a health-check or heartbeat that refreshes slower than the action itself, or a second press races the first. A retry follows the same rule: it lands on the intended result once instead of repeating its side effect, so a second attempt never sends a second email or makes a second charge.

**If you cannot say what you are changing in one sentence,** the work is large or unfamiliar enough to belong to build-intensive instead.

## Write it so a reader gets it

Code is read far more often than it is written, so the bar is a person who can follow it, not only a machine that runs it.
- **The 30-second test:** a new reader can answer "where does X come from?" and "what can change X?" in under 30 seconds. If not, cut layers or cut state.
- **Model the states the data can really be in, so the branches disappear.** Before you add an if, know the data, its valid states, and who may change it. A type or collection that cannot hold a bad combination removes the check you would otherwise repeat in every caller; a simple local flow that already reads clearly needs none of this. Two booleans that must agree are the sign: derive the second from the first, never keep them in sync by hand.
- **Collapse layers that do not earn their place:** a wrapper with one caller, a pass-through layer, an adapter with no second implementation. Prefer plain functions that return values over hidden or shared state.
- **Build a module around one thing it knows, not a sequence of steps.** A module split into load, validate, transform, save repeats the same rules in every step; one built around the thing those steps share states each rule once.
- **A comment says only the why the code cannot show, in one line.** A comment explaining what the code does means the code should say it instead. A shortcut with a known limit gets `shortcut: <the limit>, <when to upgrade>`.
- **Check outside data once, where it comes in, then trust the types inside:** no `any`, no unchecked casts, no optional fields hiding what the data really is.
- **A mistake that keeps coming back gets a structural fix, not another reminder.** A type, a constraint, a test, or a lint rule that makes the failure impossible beats a note asking people to remember. Keep notes for the judgment no mechanism can hold, and never build a framework to enforce a one-off preference.

## Prove it, deliver it clean

- **Keep one runnable check and iterate against it as you go,** so you know it works the whole way and not only at the end.
- **New logic leaves its check:** a branch, a loop, a parser, money or security gets one small test that would fail if the logic broke; a trivial change needs none. Aim it at the edges: empty, null, zero, one, many, the boundary, the off-by-one, and for an order-plus-limit query the rows past the limit (an "upcoming" list sorted ascending with a limit shows only the soonest N and drops everything after it).
- **Prove it functionally:** cite the command and its output, and never call it done without a check that actually ran. An accepted request is not a finished job: for an async step (a queued render, a background job), poll to real completion and inspect the actual output, not just a 200 or a returned ID; and when the change is meant to reach a public or customer-facing surface, confirm it there, not only in an admin API or your own logs, since the two can disagree even when both look successful.
- **Work that repeats across many files gets a script that does it or proves it,** a codemod, a generator, a check, so a reviewer can rerun it instead of trusting hand edits.
- **A verification run never touches a live directory or a process it cannot prove is its own:** when it writes to a shared build or cache folder, give it an isolated copy (a worktree, a temp checkout) whenever a dev server or other live process shares that folder, and stop a process by the ID you launched, never by what its command looks like, or the proof clobbers the very thing it was proving, or a sibling's.
- **Protect what the feature does not own by construction.** A system writing into storage it doesn't fully own (a shared drive, another team's bucket, a customer's filesystem) has to make corruption structurally impossible, not just unlikely. Route every write through one gate confined to one sub-path the app owns, open files create-only so an existing name fails instead of overwriting, keep existing data unless replacing it is the point, and drop every delete or rename the feature doesn't strictly need. Prove it with a static scan for forbidden calls outside the gate plus live escape attempts (a `..` path, a symlink, a moved or renamed root), not just a happy-path test that the feature works. (Proven on a real build: a gate confining writes to one project sub-path still let its own `mkdir(parents=True)` recreate a renamed project folder from a stale write; closed by refusing to create anything unless the folder already exists and was explicitly confirmed, and by never falling back to a different folder on the same drive once one is confirmed.)
- **Verify the evidence itself, because the rig can lie before the code does.** A check proves something only if the tool saw the state you meant, the build produced what runtime needs, and the check's failure reaches the decision that depends on it. Each of these has failed on a real build:
  - **The tool saw the wrong state.** A backgrounded browser tab freezes CSS animations and transitions at their start state, so a measurement taken there reports a false defect that was never real; finish or cancel every running animation first. A resize call can silently settle at the wrong viewport, so confirm the actual dimensions match what you asked for before trusting any check taken at that breakpoint. Some things (an installed PWA's OS chrome, a native permission prompt) the rig can never render at all, headless or not; say so instead of letting a browser PASS imply that part is proven too.
  - **The check's failure never reached the decision.** `pytest ... | tail -1 && git push` gates on `tail`'s exit code, not pytest's: the suite can fail with two real failures and the chain still reads clean and pushes. Run the check unpiped when its result decides what happens next, or gate explicitly (`pipefail`, `${PIPESTATUS[0]}`, a dedicated hook). Never trust a chain where the pass/fail decision passed through a filter first.
  - **The build never produced what runtime needs.** A build tool's static scanner silently drops what it can't see, with no error anywhere. Tailwind (and any codegen step that extracts names by scanning literal source text, not runtime values: CSS Modules, i18n key extraction) only emits output for a class or key that appears as a complete literal string; one assembled by interpolation or a computed lookup type-checks clean and renders with no console error, yet its rule is never generated. For a purely visual or CSS change, keep responsive and variant-prefixed classes as full literal strings, and verify the compiled output (the stylesheet, the computed style) actually contains the expected rule. A clean type check and a quiet console prove nothing here.
- **Never let the first real run of an irreversible action (a push, an email, a charge) be the proof.** Simulate it dry first.
- **The artifact arrives clean,** the code and the proof, with none of your own reasoning narrated above it.
- **Neither your own view of a file nor a prior command's `cd` reaches the user.** Reading an artifact only renders it into your own context, and a working directory does not survive between Bash calls: open the artifact where the user looks, and re-state absolute paths every call.

**The same failure twice is the signal to stop and rethink, not retry the same way, and past two, suspect the mechanism, not the value.** When every fix targets a style or setting and each one fails identically, the cause may not be a wrong value but the system producing it (a browser compositing a seam no style panel shows, a cache serving stale output). Stop re-guessing which value is wrong and bisect instead: disable one suspect layer or step at a time until the symptom dies, then fix what that isolates.
