---
name: ui-design
description: Use when building or changing any screen, to design it from one strong idea, set its levels, and hold the concrete craft that separates intentional design from the generic AI look.
---

# UI design

Great design is one strong idea, expressed at deliberate levels, held to a concrete craft floor: read the work and commit to the concept, set the dials every later choice reads from, then apply the fundamentals that keep it from looking machine-made. This is the universal spine of every build; a specific style "look" is a separate skill you reach for once the read calls for it.

## 1 · The Read

**Before any pixels, understand what the whole is for** — the client, the audience, and the goal this screen serves — then decide the one idea it expresses and the feeling someone should get from it, and let every later choice serve that.

- **Draw the concept from that purpose, never invent it in isolation.** A homepage seen only by non-members exists to move them to join; a screen that ignores its role in the larger product reads generic no matter how clean it looks. The audience picks the direction, not your taste.
- **This is the move that separates intentional design from generic output.** A veteran starts from a point of view rooted in the goal; a vibe coder starts from a component. Emotion belongs here too, earned because the concept calls for it, never a flourish bolted on after.
- **Classify the mode before you build:** a fresh screen, an overhaul, or a light polish that must preserve an existing identity — misjudging this is the top source of bad output, because a polish that strips real photos, brand color, and established motion loses the very thing that worked.
- **Know when the brief is out of scope for this spine.** Dense product UI, data tables, multi-step forms, editors, and realtime surfaces are their own disciplines; name that rather than forcing landing-page instincts onto them.
- **Ask at most one sharp either/or question, and only on genuine divergence** — where two real directions fork and you cannot confidently infer. If you can infer, build; a dump of questions is not diligence.

## 2 · The Dials

**Set three levels up front — variance, motion, density — and let every downstream choice read from them** instead of being decided ad hoc. This is the decision spine: it turns "does this feel right" into a few explicit settings the whole screen answers to.

- **Variance** is how far the layout departs from the safe centered default — low for a bank, high for a playful launch. It governs whether the hero is centered or split, whether cards break their equal row, how asymmetric the grid gets.
- **Motion** is how much the screen moves — near-zero where trust is the point, expressive where delight is. It governs entrance reveals, scroll behavior, and whether perpetual micro-life is present at all.
- **Density** is how tightly information packs — airy and editorial, or compact and utilitarian. It governs spacing rhythm, type scale, and how much breathes around each element.
- **Map the dials to the direction as a menu, not a law:** minimalist reads low-variance and very-low-motion; premium-consumer mid-high; playful near max. A starting point the read can override, never a lookup that decides for you.
- **Force a spread so you don't default to your first instinct.** Enumerate the real layout options for a section and deliberately vary across the page rather than reaching for the same arrangement each time; monotony is the tell that no one chose.

## 3 · The Craft

**With the concept as the aim and the dials as the settings, craft is the checkable floor** — and bland is a defect, not a safe default. Each point below is the principle and its reason; the concrete anchor is the knowledge, not a mandate, since the right value shifts per app. Build it inside the existing system: search the project's tokens and components and reuse what fits, take every visual value from one shared source of truth rather than a hardcoded hex or one-off font, and verify a dependency actually exists before importing it. When the brief itself is a known design system (Material, Fluent, Carbon, shadcn), adopt it faithfully rather than hand-rebuilding its look. In iteration the prior approved state is the starting point, not the brief — carry forward the specifics the user confirmed and build only the new delta, since an approved specific that vanishes is a regression.

**Typography — let type carry the personality, and make it legible by rule where the eye can't judge.**
- **Hold body measure near ~65ch with relaxed leading (~1.6);** set display type tight — negative tracking, leading near ~1.1 — so headings read as one shape, not a scream.
- **Build hierarchy from weight and color, not size alone** — four weights beat two, and a heading can lead by being heavier or darker rather than only bigger.
- **Reach for the tools the eye can't fake:** `clamp()` for headlines that scale continuously, `text-wrap: balance` to kill orphans, tabular figures so data columns align, positive tracking on small caps and labels.
- **A four-line heading is a width-and-size error, not a copy problem** — widen the container first, shrink second; aim for two or three lines.
- **Emphasis stays in the same family** (its own italic or bold); a contrasting serif word dropped into a sans headline reads amateur. Sans-display is the real default — serif is the single most-tested AI tell, reserved for genuinely editorial or heritage work with a reason. Prefer a characterful grotesque over the default-font tell (Inter/Roboto/Helvetica everywhere), though a neutral face is right when neutrality is the goal.

**Color — treat it as a scarce, semantic resource on a neutral base.**
- **One accent, saturation under ~80%, over a neutral (zinc/slate/stone),** with a single gray temperature across the system — mixing warm and cool grays is a real source of muddiness.
- **No pure #000 or #fff** — off-black and off-white keep depth; pure values flatten the surface.
- **Spend color on meaning** (status, tags, the one CTA) and let structure carry the rest; a scatter of accent colors is the tell. For accessible tags and badges, pair a pale background with darker same-hue text.
- **The purple-to-blue "AI gradient" is the single most common fingerprint** — name it so you catch yourself reaching for it.

**Layout — structure shows the shape of the information, and holds up across every screen.**
- **Reach for CSS Grid over flexbox percentage math** (no brittle `calc()` widths), cap width in a max-width container (~1200–1440px) with responsive padding steps, and collapse cleanly to a single column below ~768px — horizontal scroll on mobile is a hard failure, not a cosmetic one.
- **Use `min-h-[100dvh]`, not `h-screen`/`100vh`,** to avoid the iOS Safari address-bar jump — the most-repeated layout bug there is.
- **Honor fixed accessibility thresholds:** ~44px minimum touch targets, full-width mobile buttons, body text no smaller than ~14px, and a mobile fallback that drops rotations and negative-margin overlaps that break touch.
- **Lead with the one thing the eye should land on first** and make everything defer to it, so the read is first-then-second, never two elements competing for the same glance.
- **Break the equal-cards reflex when variance allows** — zig-zag, asymmetric bento, horizontal scroll — and use a card only when elevation means real hierarchy; otherwise a border, divider, or negative space. Align across columns (bottom-pin CTAs, align feature lists) and nudge 1–2px off mathematical center where the eye reads it as centered.

**Depth & material — imply one light source, and let off-values and hairlines do the work.**
- **Tint shadows toward the background hue** — a pure-black shadow on a light background reads cheap.
- **Premium depth is diffuse, not heavy:** a wide-blur low-opacity shadow (e.g. `0 20px 40px -15px rgba(0,0,0,0.05)`) with a hairline border and a large radius, over a hard drop shadow.
- **Keep the recipe when the look calls for it:** real glassmorphism is `backdrop-blur` plus a 1px inner light border plus an inset top highlight to fake edge refraction (and only on fixed or sticky layers); a beveled edge is an inset top highlight (`inset 0 1px 1px rgba(255,255,255,0.15)`); a card feels like a physical object through a nested double-bezel enclosure.
- **Keep nested corners machined** — inner radius equals outer minus the padding gap, tighter inside than out — and audit every shadow to imply a single consistent light direction.

**Motion & performance — motion is reserved for real events, and it never costs frames.**
- **Animate only transform and opacity** — never top/left/width/height, which trigger layout and paint. Drive continuous input from motion values outside React state (state re-renders every frame and collapses on mobile), react to the viewport with `IntersectionObserver`/`whileInView` over scroll listeners, and isolate motion in `'use client'` leaves rather than mixing two animation engines in one tree.
- **Honor `prefers-reduced-motion` once past a low motion threshold** — collapse loops, parallax, and scroll-hijack to static for the users who opt out — and hold Core Web Vitals before "done" (LCP <2.5s, INP <200ms, CLS <0.1).
- **Give motion weight when the dial is up:** spring physics over linear easing (stiffness ~100, damping ~20), or an expressive `cubic-bezier(0.16,1,0.3,1)`; longer decelerating durations (700–800ms+) for a sense of mass; staggered index-based reveals; tactile `:active` feedback (`translate-y-[1px]`/`scale-[0.98]`), never a glow.
- **Perpetual micro-life reads as alive only when isolated and memoized** so it never re-renders its parent; grain or noise belongs on a fixed `pointer-events-none` overlay, never a scrolling container. Every animation should justify itself in a sentence.

**Components & states — the whole cycle exists, and every interactive element responds.**
- **Design past the happy path:** loading is a skeleton sized to the real layout, not a spinner; empty is composed and teaches how to populate; error is inline, not an `alert()`.
- **Give form fields real anatomy** — label above, helper and error in the markup, a visible accent focus ring (an accessibility requirement, not a style choice), and never a placeholder standing in for a label.
- **A dead element is a tell** — interactive things need hover, active, and a 200–300ms transition, real (non-`#`) links or a visibly-disabled state, and clear active-nav indication.
- **Keep a CTA to 1–3 words with one label per intent** across the page, and customize component-library defaults (radii, colors, shadows) since the stock look is itself a default.

**Content realism — the copy and data are specific and plausible, because filler exposes itself.**
- **Use organic data over round fakes** (47.2%, real-format numbers) and specific plausible content over placeholder names (John Doe, Acme) and Lorem Ipsum — real content also surfaces real layout problems.
- **Drop the AI copywriting clichés** (Elevate, Seamless, Unleash, Next-Gen, Delve, "In the world of…") for plain specific language, and re-read every visible string for broken grammar, unclear referents, and invented precision.
- **Make images real:** generate first, a seeded placeholder (`picsum.photos/seed/{id}`) second, a labeled TODO last — never a div-based fake screenshot, which is the top structural tell. Use real SVG logos for social proof with light/dark variants.

**Pre-flight — run a mechanical last pass so review is verifiable, not vibes.** Confirm each interactive element has real states and visible focus, contrast clears WCAG AA (no invisible CTA), the grid holds with no mobile horizontal scroll, motion respects reduced-motion, and every image is real. Then hunt the AI tells directly: div-based fake screenshots, even gray cards and identical padding, three equal columns everywhere, emoji standing in for a real icon set, a scatter of accents, decorative chrome (section-number eyebrows, "Scroll to explore", status dots, fake captions), and low layout-family diversity. A specific punctuation habit can be an AI signature worth auditing — check whether one mark is doing suspicious work — without turning any single mark into a blanket ban. Prove it functionally every time, and when the work runs at depth, look at the real render and critique it against the concept before it is done.
