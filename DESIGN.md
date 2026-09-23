---
name: QUOP
description: A physicist's working board — white paper and graphite by day, black board and chalk by night.
colors:
  paper-white: "#ffffff"
  paper-muted: "#fafafa"
  paper-surface: "#ffffff"
  paper-surface-strong: "#fafafa"
  ink-foreground: "#111111"
  slate-muted: "#666666"
  hairline-border: "rgba(0, 0, 0, 0.12)"
  chalk-mark-day: "rgb(17 17 17)"
  oxblood-ink: "#8b1e3f"
  oxblood-ink-deep: "#61122b"
  oxblood-ink-soft: "rgba(139, 30, 63, 0.1)"
  true-black: "#000000"
  ink-panel: "rgba(10, 10, 10, 0.92)"
  ink-panel-strong: "#111111"
  paper-foreground: "#ffffff"
  cool-gray-muted: "#a1a1a1"
  frost-border: "rgba(255, 255, 255, 0.14)"
  chalk-mark-night: "rgb(255 255 255)"
  lamp-amber: "#f4b942"
  lamp-amber-light: "#ffd67c"
  lamp-amber-soft: "rgba(244, 185, 66, 0.14)"
  ember-orange: "#ff9d5c"
  sky-blue: "#6da8ff"
  seafoam-teal: "#75d7c0"
  coral-pink: "#f06f86"
typography:
  display:
    fontFamily: "var(--font-ibm-plex-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4.6rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "var(--font-ibm-plex-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.25rem, 2.4vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "var(--font-ibm-plex-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-ibm-plex-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 800
    letterSpacing: "0.08em"
  readout:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.78rem"
    fontWeight: 700
  equation:
    fontFamily: "var(--font-eb-garamond), Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 400
    fontStyle: "italic"
rounded:
  sm: "0.8rem"
  md: "0.95rem"
  lg: "1.1rem"
  full: "999px"
spacing:
  sm: "0.65rem"
  md: "1rem"
  lg: "1.3rem"
components:
  button-primary:
    backgroundColor: "{colors.oxblood-ink}"
    textColor: "#fffaf1"
    rounded: "{rounded.sm}"
    padding: "0.72rem 1rem"
  card-primary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.3rem"
  input-field:
    backgroundColor: "{colors.paper-surface-strong}"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.md}"
    padding: "0.8rem 0.9rem"
  nav-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.full}"
    padding: "0 0.75rem"
  nav-pill-active:
    backgroundColor: "{colors.oxblood-ink-soft}"
    textColor: "{colors.oxblood-ink-deep}"
    rounded: "{rounded.full}"
    padding: "0 0.75rem"
---

# Design System: QUOP

## Overview

**Creative North Star: "The Working Board"**

QUOP reads as a physicist's own working surface, not a software product. By day it's white paper worked over in graphite: plain white ground, hairline borders, oxblood annotations. By night it's the same room with the lights off and the board lit — true black, chalk-white marks, amber ink instead of oxblood, the FITS viewers glowing with green phosphor crosshairs and mono readouts like an old instrument dial. Nothing here is trying to look like a SaaS dashboard; it's trying to look like a surface someone actually works on.

The homepage states that literally: a board the visitor arrives at mid-session, with equations from four domains being written and wiped behind the welcome. The rest of the site is the notebook the board's results get copied into.

The mood is inviting first, credible second — the site has to work for a visitor who has never touched an optics bench, not only for the labmate who lives at one. Invitation shows up in the hand-drawn marks, the unhurried writing and erasing, and cards that respond rather than sitting inert. Credibility shows up underneath: exact values in monospace, uppercase kicker labels on every card ("CALCULATOR", "PLOTTER"), and instrument-grade FITS readouts that don't soften their numbers for anyone.

Two color systems run in parallel and must not be confused: the oxblood-ink/lamp-amber pair is the notebook's *own* ink — used for interactive accents, focus rings, and emphasis text everywhere. The four section colors (ember-orange, sky-blue, seafoam-teal, coral-pink) are a separate, purely categorical wayfinding system — they mark which of the four site sections (Calculators, Theory, Plotters, Experiment) something belongs to, though nothing currently renders them (see Status, below). They are tabs on a notebook's colored dividers, not brand accents; don't let them compete with the ink pair.

**Key Characteristics:**
- White paper by day, black board by night — a full hue swap on the accent, not just a lightness shift
- Every interactive surface carries an ambient shadow at rest and lifts further on hover — nothing in this system sits flat
- Uppercase, letter-spaced kicker labels mark structure and category; regular-case text is always actual content
- FITS/data-instrument surfaces (crosshair readouts, colorbars) speak in mono type and green-phosphor/amber highlights, deliberately more "instrument" than the plain chrome around them
- Four categorical wayfinding colors (orange/blue/teal/pink) identify site sections; they never substitute for the oxblood/amber ink accent
- Hand-drawn marks — wobbled card frames, textured chalk strokes, italic serif equations — belong to the homepage board and nowhere else; every other surface is precise

## Colors

Two accents that trade places with the theme, a neutral scale that runs to pure white and pure black, and four categorical section colors that stay out of the ink pair's way.

### Primary
- **Oxblood Ink** (`#8b1e3f`, day) / **Lamp Amber** (`#f4b942`, night): the notebook's own accent — active nav pills, focus rings, kicker text, calculator result emphasis, the primary button fill. **The Day/Night Ink Rule.** The accent does not merely lighten between themes, it swaps hue entirely: burgundy ink by day, amber lamplight by night. Any future accent work must preserve this hue swap, not soften it into a shared mid-tone.
- **Oxblood Ink Deep** (`#61122b`, day) / **Lamp Amber Light** (`#ffd67c`, night): the darker/lighter step of the ink pair, used for kicker labels and stronger emphasis text where the base accent would be too loud as a text color.
- **Oxblood Ink Soft** (`rgba(139, 30, 63, 0.1)`, day) / **Lamp Amber Soft** (`rgba(244, 185, 66, 0.14)`, night): the wash behind an active nav pill or hovered link — never used as a fill for large areas.

### Section Wayfinding Colors (categorical, not brand accent)
- **Ember Orange** (`#ff9d5c`) — Calculators.
- **Sky Blue** (`#6da8ff`) — Theory.
- **Seafoam Teal** (`#75d7c0`) — Plotters.
- **Coral Pink** (`#f06f86`) — Experiment.

**The Divider Rule.** These four colors exist to answer "which section is this," nothing else. Do not promote one of them into a general UI accent, and do not let the ink pair (Oxblood/Amber) bleed into a wayfinding role — the two systems answer different questions and must stay visually separable.

**Status: currently dormant.** They survive as the `accent` field on `navSections`, but the only components that read it (`TransitionProvider`, `WavefunctionBanner`) are unwired dead code, so no wayfinding color is visible anywhere in the live app. They were last seen as the 3px top-edge stripe on the old 2×2 homepage hero tiles, which the chalkboard hero replaced. The system is documented here because it is the site's only categorical signal and is worth reviving deliberately — but until something renders it, treat it as a decision pending, not a live rule. The chalk section cards pointedly do not use it: on a board, everything is written in the same hand.

### Neutral
- **Paper White** (`#ffffff`, day) / **True Black** (`#000000`, night): page background. Flat — there is no radial page glow.
- **Paper Muted** (`#fafafa`, day) / **True Black** (`#000000`, night): the second neutral step, used for the chalkboard's radial falloff and for nested surfaces. In dark mode it is identical to the background by design; the board's texture, not a gradient, is what gives the surface depth.
- **Paper Surface** (`#ffffff`, day) / **Ink Panel** (`rgba(10, 10, 10, 0.92)`, night): card and nav-bar background, used with backdrop blur on the nav.
- **Paper Surface Strong** (`#fafafa`, day) / **Ink Panel Strong** (`#111111`, night): opaque surface for inputs and nested panels.
- **Ink Foreground** (`#111111`, day) / **Paper Foreground** (`#ffffff`, night): body text.
- **Slate Muted** (`#666666`, day) / **Cool Gray Muted** (`#a1a1a1`, night): secondary text, leads, captions.
- **Hairline Border** (`rgba(0, 0, 0, 0.12)`, day) / **Frost Border** (`rgba(255, 255, 255, 0.14)`, night): the hairline border on every card, input, and divider.
- **Chalk Mark** (`rgb(17 17 17)`, day / `rgb(255 255 255)`, night): exposed as the `--mark` triplet, the colour every hand-drawn stroke on the homepage is mixed from. Strokes never use it at full strength — `--chalk-alpha` (0.26 day, 0.30 night) is the ceiling, and it is the single value most worth re-judging when the hero changes.

## Typography

**Body & Display Font:** IBM Plex Sans (with `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`)
**Readout Font:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` — reserved for FITS/instrument readouts, inline code, mono data fields, and the route label on a chalk card.
**Equation Font:** EB Garamond italic (`--font-serif`) — reserved for the equations on the homepage board, which are hand-set HTML rather than KaTeX. Nothing else on the site is set in serif.

**Character:** IBM Plex Sans carries the interface alone — there's no separate display face. Size and weight do the work of hierarchy. Two faces depart from it, each scoped tightly: mono where the content is genuinely measured data, and Garamond italic where the content is a physicist's handwriting.

### Hierarchy
- **Display** (700, `clamp(2.2rem, 5vw, 4.6rem)`, line-height 1.02, letter-spacing -0.03em): page `h1`s — one per page, tight and large.
- **Headline** (700, `clamp(1.25rem, 2.4vw, 1.9rem)`, line-height 1.15): `h2`s inside cards and sections.
- **Body** (400, 1rem, line-height 1.6): running copy. Lead paragraphs step up to `1.08rem` in the muted color, capped at `44rem` measure.
- **Label** (800, `0.75–0.84rem`, letter-spacing 0.08em, uppercase): kicker tags ("CALCULATOR", "PLOTTER"), nav pill text, button-cluster labels — always in the ink-deep accent color or muted, never body color.
- **Readout** (700, `0.72–0.78rem`, mono): FITS crosshair coordinates, colorbar labels, mono text inputs.
- **Result** (800, `clamp(2rem, 5vw, 3.2rem)`, line-height 0.95, letter-spacing -0.04em): the one place numbers get genuinely large — calculator answers like pace results.
- **Equation** (400 italic serif, `1.5–1.8rem`): the board's drifting equations. Sized per equation rather than by a scale step, because the shorter ones need to be larger to hold the same visual weight.

### Named Rules
**The Case Rule.** Uppercase + letter-spacing means "this is structure/category," never body content. If it's something the user typed or a real physical quantity, it's sentence case and proportional type; if it's a label the interface itself is asserting, it's uppercase and tracked.

## Layout

The page is a single centered column: `max-w-6xl`, `px-4`/`sm:px-6`, `pt-8 pb-16`, sitting under a sticky, blurred nav bar (`backdrop-filter: blur(14px)`) that never scrolls away. The nav itself is a three-column grid (`1fr auto 1fr`) — left links, centered wordmark, right links — with hover-revealed dropdown panels beneath section labels.

Content grids adapt per surface: `cardGrid` stacks single-column (a vertical list of section cards on index pages like Calculators/Plotters); `calculatorGrid` uses `repeat(auto-fit, minmax(250px, 1fr))` so calculator inputs reflow by available width; the pace calculator's dual-panel-with-swap layout (`1fr auto 1fr`) collapses to a single column under 900px. The homepage is the chalkboard hero (`min-height: clamp(400px, 66vh, 640px)`, centered welcome copy) followed by the four chalk section cards, which run `1fr` / `2×` / `4×` at 0 / 640px / 1000px.

Two custom breakpoints recur throughout (900px, 640px/720px) alongside Tailwind's `sm:` (640px) on newer Tailwind-authored components — both idioms are currently live in the codebase; match whichever a given file already uses rather than introducing a third.

## Elevation & Depth

**The Always-Lifted Rule.** Nothing in the *interface* sits perfectly flat. Every card, input, and button carries a soft ambient shadow at rest and deepens that shadow (plus a small `translateY` lift) on hover or focus. Flatness there would read as unfinished, not minimal — this is a confirmed, deliberate property of the system, not an incidental default to be corrected later.

**The one exception: the chalk card family.** The homepage's four section cards carry no shadow, no fill, and no border — they are a wobbled SVG frame drawn onto the page surface. A mark on a board has nothing to cast a shadow with, and giving these cards one would break the single idea the homepage is built on. The exception is scoped to `.chalkCard` and does not extend to any other card; a new card type defaults back to the Always-Lifted Rule unless it is literally drawn in chalk.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 20px 50px rgba(31, 41, 51, 0.1)`, day / `0 28px 60px rgba(0, 0, 0, 0.35)`, night): the resting shadow under every `sectionCard`, `inputCard`, and `infoPanel`.
- **Control ambient** (`box-shadow: 0 12px 24px rgba(91, 102, 117, 0.14)`, deepens to `0 16px 28px rgba(91, 102, 117, 0.18)` on hover): the metallic plotter/action buttons (`buttonControl`).
- **Focus ring** (`outline: 3px solid rgba(139, 30, 63, 0.3)`, day / `rgba(244, 185, 66, 0.4)`, night, `outline-offset: 3px`): keyboard focus on links, buttons, and active input containers — uses the ink-accent pair, not a generic blue.

## Shapes

Corners are soft throughout but not uniform: primary buttons and small controls round to `0.8rem`, inputs and secondary surfaces to `0.9–0.95rem`, primary cards to the largest radius at `1.1rem`. Pills (nav items) and true circles (the theme toggle) go fully round (`rounded-full`/`999px`). A 1px hairline border in the hairline/frost neutral appears on almost every container. The chalk section cards are the one departure: no radius and no border at all, because their edge is a drawn line rather than a box — see the Chalk Section Cards component.

## Components

Buttons, cards, and inputs are precise and instrument-like: numbers are exact, controls are legible at a glance, and interaction feedback (lift, shadow, ring) is immediate rather than decorative. The warmth lives in the palette and the always-lifted shadows, not in soft or playful component behavior.

### Buttons
- **Shape:** primary actions round to `0.8rem`; the plotter/calculator action grid (`buttonControl`) rounds to `1rem`.
- **Primary** (`buttonLink`): solid Oxblood Ink / Lamp Amber fill, `#fffaf1` text (day) or `#1a1d26` (night), bold weight, `0.72rem 1rem` padding, no border. Lifts `translateY(-1px)` on hover with no color change.
- **Action grid** (`buttonControl`): a distinct neutral-metal gradient fill (`linear-gradient(135deg, #d7dbe2, #bcc3cd)`) used for plotter/data-action buttons, not the ink accent — reads as hardware, not as a call-to-action. Its secondary variant swaps to the surface gradient with the standard hairline border.
- **Nav pills** (`NavItem`): fully round, transparent at rest, Oxblood/Amber-soft wash + ink-deep text when active or hovered.

### Cards / Containers
- **Corner Style:** `1.1rem` (`sectionCard`, `inputCard`, `infoPanel`).
- **Background:** Paper Surface / Ink Panel (translucent), always paired with the Card ambient shadow.
- **Border:** 1px hairline, Sepia/Frost.
- **Internal Padding:** `1.3rem`, with `0.85rem` gap between internal stacked elements.
- **Signature detail — the kicker:** every section card opens with an uppercase, letter-spaced category tag (`sectionCard__kicker`) in Oxblood-Deep/Amber-Light before its heading — this is the card's defining tell, not optional flourish.

### Inputs / Fields
- **Style:** bordered outer container (`field__control`, `0.9rem` radius, Sepia/Frost border) housing a borderless inner `input`/`textarea` on Paper-Surface-Strong background; a unit label sits inline at the end in muted color.
- **File input:** the one dashed-border treatment in the system (`1px dashed`), signaling "drop a file here" distinctly from typed fields.
- **Focus:** the ink-accent Focus Ring (see Elevation & Depth), not a border-color change.

### Navigation
- Sticky, blurred, three-column pill nav; active section gets the Oxblood/Amber-soft pill treatment; hovering a section reveals its links in a rounded flyout panel (`1.1rem`-ish radius, same Paper Surface + border + shadow as any card).

### Chalkboard Hero (homepage)
The board fills the top of the homepage and inherits the page background, so it is not a panel sitting on the page — it *is* the page, given a surface. Three layers stack under the welcome copy: a canvas of procedural grain (a faint radial falloff from `--background` to `--background-muted`, fine speckle, and long fibres); a canvas reserved for eraser ghosts, which is empty at a `BOARD_HISTORY` of 0 and fills with wipe arcs and illegible earlier working as it is raised; and the chalk layer where equations are written.

Four equations, one per domain — electromagnetism, classical mechanics, statistical mechanics, quantum mechanics — cycle through ten fixed slots around the edge, two on screen at a time by default. Each is clipped in from the left over 1.6s (the writing), holds 8–13s, then fades (the wipe). They are hand-set HTML in Garamond italic, not KaTeX: none of the four needs a fraction or an integral, so the dependency would buy nothing and the text stays selectable. The quantum one carries the ink accent; the other three are graphite.

**The Quiet Centre Rule.** The chalk layer is masked by a radial gradient so marks dissolve before they reach the welcome text rather than colliding with it. Any new equation slot must respect that mask; do not solve an overlap by moving the welcome copy.

Everything the eye judges is a named constant at the top of `chalkboard-hero.tsx` (`ON_SCREEN_AT_ONCE`, `BOARD_HISTORY`, `HOLD_MS`, `RESPAWN_MS`, `SEED`, the equation and slot tables) or a CSS token (`--mark`, `--chalk-alpha`, `--chalk-dust`, `--chalk-filter`). Tuning belongs in those two places and nowhere else.

### Chalk Section Cards (homepage)
Four cards — Plotter, Calculator, Theory, Experiment — each a hand-drawn frame around a glyph, a name, a one-line tag in muted text, and the route in mono at the foot. The frame is four wobbled SVG edges with a gap at each corner, seeded per card so no two are identical, drawn on with `stroke-dasharray` when the card scrolls into view; the glyph and text follow on a short stagger. Hover darkens the frame and turns the name to the ink accent. These cards are flat by design — see the Always-Lifted Rule's exception — and they carry the mono route instead of the uppercase kicker every other card opens with, because a route is a real value and the Case Rule applies.

### Signature Component — FITS Instrument Readout
The FITS/CSV plotters depart deliberately from the notebook language into instrument-panel language: a checkerboard "transparency" background behind the rendered frame, a green-phosphor crosshair (`#9cff8f`) with a glowing box marker, a translucent dark mono-font coordinate readout badge (`rgba(12, 18, 14, 0.78)` background, `#b9ffb3` text), and a vertical colorbar strip. Icon-button toolbars use amber highlighting (`rgba(230, 171, 88, 0.16)` background, `#8f5f12`/`#ffd99d` text) for active/open states rather than the primary Oxblood/Amber pair — this toolbar-amber is a separate, narrower accent scoped only to these instrument controls.

## Do's and Don'ts

### Do:
- **Do** preserve the full hue swap on the primary accent between themes (Oxblood Ink ↔ Lamp Amber) — see The Day/Night Ink Rule.
- **Do** give every interactive surface a resting shadow that deepens on hover/focus — see The Always-Lifted Rule. A flat card or button is a bug here, not a style choice, unless it is part of the chalk card family.
- **Do** keep hand-drawn texture on the homepage board and off everything else — the chalk filters, the wobbled frames, and the serif italic are one scoped gesture, not a site-wide style.
- **Do** keep the four section wayfinding colors (ember-orange, sky-blue, seafoam-teal, coral-pink) purely categorical — section identification only, never a general accent.
- **Do** reserve uppercase/letter-spaced type for structural labels (kickers, nav, cluster labels) and keep all real content sentence-case — see The Case Rule.
- **Do** route FITS/data-instrument surfaces through mono type and the green-phosphor/toolbar-amber language, keeping them visibly distinct from the plain chrome around them.

### Don't:
- **Don't** treat `TransitionProvider`, `NavTransitionLink`, `WavefunctionBanner`, or the `orbitalPhase` field on `navSections` as part of the live design system. They exist in source but are not wired into the app (no page imports `TransitionProvider` or `WavefunctionBanner`; `AppShell` uses a plain `Link`, not `NavTransitionLink`; `orbitalPhase` is never read). They're leftover from a prior orbital/atom hero and should be treated as dead code, not incumbent authority, until someone deliberately revives or removes them.
- **Don't** raise `--chalk-alpha` until the marks read as confidently as interface text. They are meant to sit at the edge of legibility; an equation that competes with the welcome copy has been pushed too far.
- **Don't** let the Oxblood/Amber ink pair and the section wayfinding colors trade places — they answer "what's emphasized" and "what section is this" respectively, and mixing them removes the only categorical signal the site has.
- **Don't** flatten any card, button, or input to zero shadow at rest — see The Always-Lifted Rule.
- **Don't** mix the two live corner-radius idioms (Tailwind's `rounded-2xl`/`rounded-full` on newer components vs. the hand-set `0.8–1.1rem` scale on older CSS classes) within a single component; match whichever the surrounding file already uses.
