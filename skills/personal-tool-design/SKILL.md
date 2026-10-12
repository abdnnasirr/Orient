---
name: personal-tool-design
description: Use when building or redesigning a tool Abdullah uses himself — a practice app, tracker, or personal dashboard — to default to a coach that hands him the next action instead of a library he has to browse.
---

# Personal tool design

A tool built for Abdullah himself is not a product with pages to explore — it's an instrument with one job. `ui-design` names dense product UI as its own discipline and hands it off; `form-design` covers the grammar of collecting input. This is the third: what a personal practice, tracking, or doing tool should default to once it's his and only his. Four moves: read the one job before the pages, strip informational overwhelm the same as visual overwhelm, generalize a correction to its concept, and ground "simple" in his own voice.

## 1 · Open on the job, not a home screen

Before laying out navigation, name the tool's one real job and ask whether it can open directly into doing it, with the next action already chosen. A library shape — a home screen, a nav bar, pages to pick between, browse-then-drill — is the wrong default here; it makes him choose when the tool should already know. The coach shape is the default instead: one card on open, the next thing to do already picked (read his own log — weakest spot first, otherwise the highest-priority thing untouched longest), two or three lines on what it is and how to win it, one button to start. Everything else — the full library, reference lookups, settings — moves behind a single quiet "More," reachable but never in front of him. If opening the tool hands him a catalog instead of a chosen next thing, the first design is already wrong.

## 2 · Strip informational overwhelm, not just visual overwhelm

Theme and spacing are the shallow half of "overwhelming" — the other half is the information itself, and fixing only the first will still fail the bar. Internal bookkeeping that exists for the system's own reasoning — provenance tags, data-lineage flags, cross-reference metadata, anything that answers "where did this come from" rather than "what do I do" — belongs in the data, never on his screen; a grader or downstream process can still read the full record while the screen shows only the plain-language version. Ask the same question of every element, independent of how well it's laid out: does this help him act, right here? If not, it's noise regardless of how cleanly it's boxed.

## 3 · A correction on two examples names a concept, not a checklist

When he flags "this label" and "that tag" as too much, those are illustrations of a pattern, not the whole punch list — fix the concept everywhere it appears in the tool, not just the two cited instances. Stopping at the literal examples given is the failure; the tell that it happened is him having to say "those are just two examples" a second time.

## 4 · Ground "simple" in his own voice, never a guess

"Make it simpler" is not a generic register — it's specific to him. Pull from `my-voice` and the global instructions before rewriting copy, rather than reaching for a default plain-language style; the bar is what reads simple *to Abdullah specifically*, not simple in the abstract.

## Scope

This is for surfaces only he uses — the same boundary `my-voice` draws for his voice specifically. A client-facing product still starts from `ui-design` §1's audience-first read: their user, their job, their shape. Don't import the coach default into a build meant for someone else's users.
