---
name: write-prompts
description: Use when writing or editing any system prompt, skill, or doc, to render intent into a finished file in the user's voice and structure.
---

# Write prompts

The simpler the better: render rough notes into the finished file in the user's voice, framing the whole before the parts at every level, the section and the parts within it alike, and carrying only what the notes carry.

You turn intent into a finished artifact and nothing else. Given rough notes, produce the file: no preamble, no meta-narration, no note about what you are about to do. Start with the file's required opening: frontmatter when the format requires it, otherwise the title. Every line is final copy the reader sees, present tense, what is and never how it got built.

## The Voice

Lead with the point, then the reasoning, briefly. I work best when I know the why.
Write full natural sentences, not telegraphic fragments: open with a punchy clause where it lands, then finish the thought completely. Collaborative, not deferential or clipped: "I work best when I know the why," not "I need the why."
Say each idea once, in its one home. When two lines circle the same point, merge them; when a clause restates the line before it, cut it. No hype, no filler, no jargon; don't introduce terms or concepts that aren't obvious or don't fit.
Distill the note to its principle, never the literal words. The note is a picture of the intent, not copy to paste: lift the reusable rule out of the one-off instance. Then find the line whose meaning it belongs to and sharpen that one; add a new line only when the idea has no home yet. A line bolted on verbatim, or a new line restating ones already there, is the failure, even when the words came straight from the user. The same test applies to your own findings, not just the user's words: if the next new case needs its own new line instead of sharpening one already there, you have written a checklist, not a concept.
Brevity scales inversely to importance: expand the load-bearing line, compress the obvious to one line, cut the genuinely empty. The most important line in a section is usually the fuller, two-clause one, never the shortest; when in doubt on a key line, write more, not less. The brevity rule reaches your own connective tissue, never a load-bearing line.
A length limit needs a number, not a size metaphor. Tested head to head across four rounds: "a page," "one screen," "fits on one screen" changed nothing, every writer still ran long; "under a thousand words," "under 250 words" held on every sample. A metaphor gives the model nothing to check itself against; a number does.

## Structure for scanning

The reader should grasp the shape at a glance, then read deeper, the way orient-overview and the global CLAUDE.md do. A wall of crammed sentences fails this even when every word is right, so structure for the skim.
- **Give each distinct point a bold lead-in,** so the eye lands on the point before its detail.
- **Turn a list into bullets, and a sequence the work runs in into a numbered list.**
- **Keep one point tight:** its sentences sit together with no blank line splitting them, and a blank line falls only between distinct points, never the loose paragraph-per-sentence sprawl.
- **Cut every word that is not critical:** if a sentence can go, it goes; if a clause restates the one before, delete it.
The test: skim only the bold lead-ins and the bullets, and the whole still makes sense.

## The System-Prompt Template

Three sections, each a frame before its detail, in order. Fill each from the notes, drop one the notes do not feed, add one only if an idea fits nowhere else.
Open with one line that compresses the whole into its essence, then the sections, nothing else before them.
Who you are & why is the agent's identity and purpose: what it is, what it is for, the reasoning behind it. This frames everything below it.
What you can reach is the agent's surface: the tools, files, and context it acts on, and the bounds of each.
How you operate is the agent's method: how it reasons, the order it works in, what it does before it asks. When it judges against a known list of criteria, give the concrete list, but say outright that the list is a floor, not a ceiling: what to check first, never the whole boundary of what counts as a problem.
One idea, one home. Place each line by what its section is for, then scan before finalizing for the same idea landing in two places.

## The Skill Format

A skill is a SKILL.md: YAML frontmatter, then the body.
Frontmatter carries `name` and a one-sentence `description`. The description is the trigger the model matches on, so write it as one: lead with `Use when [the situation]`, then what it does. A condition loads more reliably than a capability (`Use when writing a skill`, not `Writes skills`).
The body is the how-to, framed whole before parts: open with what the skill is and when it fires, like a consulting deck, then the method, then the detail. Lead with the essence in one standalone line, then name every move it covers — count and labels in one sentence before the detailed breakdown: "two passes: North Star, then technical check" or "three moves: A, B, C." A fresh reader should know the shape before they see the parts. A skill teaches concepts and ideas, never frameworks and structure to fill: slots in the skill become slots in the output, and a reader can see them. The shorter the skill, the better. It practices what it preaches: a skill about tight writing is itself tight, a skill about structure is itself structured. When done right, anyone can follow it.

## Skill Support Files

The skill is the reusable unit. If it needs reusable code, examples, assets, templates, or deeper reference notes, put them inside that skill folder under `scripts/`, `references/`, `assets/`, or `templates/`.
Name the support file from the skill body only when the model should read it. A file the skill never points to is storage, not behavior.

## Hardening a Prompt for a Weak Model

When a shipped prompt behaves unreliably on the model actually running it in production, don't reason from the prompt text alone. Run the identical prompt against the identical input through the strongest model available, then diff the two outputs. The gap it names is specific, not "be more thorough": a count that's lower, a field filed under the wrong name, a quote that got cleaned up in the copying. Write the fix at exactly that gap.

A prompt-level fix earns its place only if it holds on a retest against the weak model. If it doesn't, move it into code instead of restating it harder: never send the model a case it has nothing for, check structurally rather than asking politely. Keep the fix a parameter, not a hardcoded ceiling, so a stronger model swapped in later doesn't inherit limits that were only ever needed for the weak one.

## Before You Output

Run this silently, then emit only the file.
Preserve the format's required opening. A skill starts with its YAML frontmatter, then the title; a Markdown document without frontmatter starts with its title. No commentary goes before the file.
It scans: each distinct point has a bold lead-in or a bullet, lists are bullets, and the bold lead-ins alone carry the gist.
Within a point the sentences sit tight together; a blank line falls only between distinct points, never per sentence.
Each line is in the section its meaning belongs to, and no idea, image, or anchor appears twice.
The load-bearing lines are the fuller ones, not the shortest; if a key line got compressed, expand it back.
