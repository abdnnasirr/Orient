---
name: write-prompts
description: Use when writing or editing any system prompt, skill, or doc, to render intent into a finished file in the user's voice and structure.
---

# Write prompts

The simpler the better: render rough notes into the finished file in the user's voice, framing the whole before the parts at every level, the section and the parts within it alike, and carrying only what the notes carry.

You turn intent into a finished artifact and nothing else. Given rough notes, produce the file: no preamble, no meta-narration, no note about what you are about to do. The first character you output is the file's first character, the title. Every line is final copy the reader sees, present tense, what is and never how it got built.

## The Voice

Lead with the point, then the reasoning, briefly. I work best when I know the why.
Write full natural sentences, not telegraphic fragments: open with a punchy clause where it lands, then finish the thought completely. Collaborative, not deferential or clipped: "I work best when I know the why," not "I need the why."
Say each idea once, in its one home. When two lines circle the same point, merge them; when a clause restates the line before it, cut it. No hype, no filler, no jargon; don't introduce terms or concepts that aren't obvious or don't fit.
Distill the note to its principle, never the literal words. The note is a picture of the intent, not copy to paste: lift the reusable rule out of the one-off instance. Then find the line whose meaning it belongs to and sharpen that one; add a new line only when the idea has no home yet. A line bolted on verbatim, or a new line restating ones already there, is the failure, even when the words came straight from the user.
Brevity scales inversely to importance: expand the load-bearing line, compress the obvious to one line, cut the genuinely empty. The most important line in a section is usually the fuller, two-clause one, never the shortest; when in doubt on a key line, write more, not less. The brevity rule reaches your own connective tissue, never a load-bearing line.

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
How you operate is the agent's method: how it reasons, the order it works in, what it does before it asks.
One idea, one home. Place each line by what its section is for, then scan before finalizing for the same idea landing in two places.

## The Skill Format

A skill is a SKILL.md: YAML frontmatter, then the body.
Frontmatter carries `name` and a one-sentence `description`. The description is the trigger the model matches on, so write it as one: lead with `Use when [the situation]`, then what it does. A condition loads more reliably than a capability (`Use when writing a skill`, not `Writes skills`).
The body is the how-to, framed whole before parts: open with what the skill is and when it fires, like a consulting deck, then the method, then the detail. Lead with the essence in one standalone line, then name every move it covers — count and labels in one sentence before the detailed breakdown: "two passes: North Star, then technical check" or "three moves: A, B, C." A fresh reader should know the shape before they see the parts. It practices what it preaches: a skill about tight writing is itself tight, a skill about structure is itself structured. When done right, anyone can follow it.

## Skill Support Files

The skill is the reusable unit. If it needs reusable code, examples, assets, templates, or deeper reference notes, put them inside that skill folder under `scripts/`, `references/`, `assets/`, or `templates/`.
Name the support file from the skill body only when the model should read it. A file the skill never points to is storage, not behavior.

## Before You Output

Run this silently, then emit only the file.
First character is the title, a single `#` heading, with no line before it.
It scans: each distinct point has a bold lead-in or a bullet, lists are bullets, and the bold lead-ins alone carry the gist.
Within a point the sentences sit tight together; a blank line falls only between distinct points, never per sentence.
Each line is in the section its meaning belongs to, and no idea, image, or anchor appears twice.
The load-bearing lines are the fuller ones, not the shortest; if a key line got compressed, expand it back.
