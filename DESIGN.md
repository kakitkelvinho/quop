---
name: QUOP
description: A physicist's parchment notebook by day, a lit instrument console by night.
colors:
  warm-parchment: "#f7f1e6"
  parchment-muted: "#efe6d5"
  paper-surface: "rgba(255, 255, 255, 0.92)"
  paper-surface-strong: "#fffdf8"
  ink-foreground: "#1f2933"
  slate-muted: "#5b6675"
  sepia-border: "rgba(102, 51, 0, 0.14)"
  oxblood-ink: "#8b1e3f"
  oxblood-ink-deep: "#61122b"
  oxblood-ink-soft: "rgba(139, 30, 63, 0.1)"
  midnight-slate: "#151821"
  midnight-slate-muted: "#1b2230"
  ink-panel: "rgba(28, 34, 48, 0.92)"
  ink-panel-strong: "#222a3a"
  paper-foreground: "#f2f4f8"
  cool-gray-muted: "#b1bac7"
  frost-border: "rgba(255, 255, 255, 0.1)"
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

**Creative North Star: "The Lab Notebook"**

QUOP reads as a working physicist's notebook, not a software product. By day it's warm parchment and oxblood ink: cream backgrounds, hairline sepia borders, burgundy annotations. By night the same notebook sits open under a desk lamp — midnight-navy pages, amber ink instead of oxblood, the FITS viewers glowing with green phosphor crosshairs and mono-font readouts like an old instrument's readout dial. Nothing here is trying to look like a SaaS dashboard; it's trying to look like a real object a physicist actually keeps at their desk.

The mood is warm and inviting first, credible second — the site has to work for a visitor who has never touched an optics bench, not only for the labmate who lives at one. Warmth shows up in the parchment palette, the soft radial glow behind the page, and cards that lift gently toward you on hover rather than sitting inert. Credibility shows up underneath that warmth: exact values in monospace, uppercase kicker labels on every card ("CALCULATOR", "PLOTTER"), and instrument-grade FITS readouts that don't soften their numbers for anyone.

Two color systems run in parallel and must not be confused: the oxblood-ink/lamp-amber pair is the notebook's *own* ink — used for interactive accents, focus rings, and emphasis text everywhere. The four section colors (ember-orange, sky-blue, seafoam-teal, coral-pink) are a separate, purely categorical wayfinding system — they mark which of the four site sections (Calculators, Theory, Plotters, Experiment) something belongs to, currently visible as the top-edge stripe on the homepage's four hero tiles. They are tabs on a notebook's colored dividers, not brand accents; don't let them compete with the ink pair.

**Key Characteristics:**
- Warm parchment by day, midnight instrument-panel by night — a full hue swap on the accent, not just a lightness shift
- Every interactive surface carries an ambient shadow at rest and lifts further on hover — nothing in this system sits flat
- Uppercase, letter-spaced kicker labels mark structure and category; regular-case text is always actual content
- FITS/data-instrument surfaces (crosshair readouts, colorbars) speak in mono type and green-phosphor/amber highlights, deliberately more "instrument" than the parchment chrome around them
- Four categorical wayfinding colors (orange/blue/teal/pink) identify site sections; they never substitute for the oxblood/amber ink accent

## Colors

Two accents that trade places with the theme, a warm neutral scale, and four categorical section colors that stay out of the ink pair's way.

### Primary
- **Oxblood Ink** (`#8b1e3f`, day) / **Lamp Amber** (`#f4b942`, night): the notebook's own accent — active nav pills, focus rings, kicker text, calculator result emphasis, the primary button fill. **The Day/Night Ink Rule.** The accent does not merely lighten between themes, it swaps hue entirely: burgundy ink by day, amber lamplight by night. Any future accent work must preserve this hue swap, not soften it into a shared mid-tone.
- **Oxblood Ink Deep** (`#61122b`, day) / **Lamp Amber Light** (`#ffd67c`, night): the darker/lighter step of the ink pair, used for kicker labels and stronger emphasis text where the base accent would be too loud as a text color.
- **Oxblood Ink Soft** (`rgba(139, 30, 63, 0.1)`, day) / **Lamp Amber Soft** (`rgba(244, 185, 66, 0.14)`, night): the wash behind an active nav pill or hovered link — never used as a fill for large areas.

### Section Wayfinding Colors (categorical, not brand accent)
- **Ember Orange** (`#ff9d5c`) — Calculators.
- **Sky Blue** (`#6da8ff`) — Theory.
- **Seafoam Teal** (`#75d7c0`) — Plotters.
- **Coral Pink** (`#f06f86`) — Experiment.

**The Divider Rule.** These four colors exist to answer "which section is this," nothing else. They currently appear only as the 3px top-edge stripe on the homepage's four hero tiles. Do not promote one of them into a general UI accent, and do not let the ink pair (Oxblood/Amber) bleed into a wayfinding role — the two systems answer different questions and must stay visually separable.

### Neutral
- **Warm Parchment** (`#f7f1e6`, day) / **Midnight Slate** (`#151821`, night): page background, paired with a barely-visible radial glow (an oxblood wash by day) behind the body.
- **Parchment Muted** (`#efe6d5`, day) / **Midnight Slate Muted** (`#1b2230`, night): the second stop in the page's background gradient.
- **Paper Surface** (`rgba(255, 255, 255, 0.92)`, day) / **Ink Panel** (`rgba(28, 34, 48, 0.92)`, night): translucent card and nav-bar background, always used with backdrop blur on the nav.
- **Paper Surface Strong** (`#fffdf8`, day) / **Ink Panel Strong** (`#222a3a`, night): opaque surface for inputs and nested panels that shouldn't show the page glow through them.
- **Ink Foreground** (`#1f2933`, day) / **Paper Foreground** (`#f2f4f8`, night): body text.
- **Slate Muted** (`#5b6675`, day) / **Cool Gray Muted** (`#b1bac7`, night): secondary text, leads, captions.
- **Sepia Border** (`rgba(102, 51, 0, 0.14)`, day) / **Frost Border** (`rgba(255, 255, 255, 0.1)`, night): the hairline border on every card, input, and divider.

## Typography

**Body & Display Font:** IBM Plex Sans (with `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`)
**Readout Font:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` — reserved for FITS/instrument readouts, inline code, and mono data fields.

**Character:** IBM Plex Sans carries the whole system alone — there's no separate display face. Size and weight do the work of hierarchy; the mono face is the one deliberate departure, and it only shows up where the content is genuinely measured data, not for decoration.

### Hierarchy
- **Display** (700, `clamp(2.2rem, 5vw, 4.6rem)`, line-height 1.02, letter-spacing -0.03em): page `h1`s — one per page, tight and large.
- **Headline** (700, `clamp(1.25rem, 2.4vw, 1.9rem)`, line-height 1.15): `h2`s inside cards and sections.
- **Body** (400, 1rem, line-height 1.6): running copy. Lead paragraphs step up to `1.08rem` in the muted color, capped at `44rem` measure.
- **Label** (800, `0.75–0.84rem`, letter-spacing 0.08em, uppercase): kicker tags ("CALCULATOR", "PLOTTER"), nav pill text, button-cluster labels — always in the ink-deep accent color or muted, never body color.
- **Readout** (700, `0.72–0.78rem`, mono): FITS crosshair coordinates, colorbar labels, mono text inputs.
- **Result** (800, `clamp(2rem, 5vw, 3.2rem)`, line-height 0.95, letter-spacing -0.04em): the one place numbers get genuinely large — calculator answers like pace results.

### Named Rules
**The Case Rule.** Uppercase + letter-spacing means "this is structure/category," never body content. If it's something the user typed or a real physical quantity, it's sentence case and proportional type; if it's a label the interface itself is asserting, it's uppercase and tracked.

## Layout

The page is a single centered column: `max-w-6xl`, `px-4`/`sm:px-6`, `pt-8 pb-16`, sitting under a sticky, blurred nav bar (`backdrop-filter: blur(14px)`) that never scrolls away. The nav itself is a three-column grid (`1fr auto 1fr`) — left links, centered wordmark, right links — with hover-revealed dropdown panels beneath section labels.

Content grids adapt per surface: `cardGrid` stacks single-column (a vertical list of section cards on index pages like Calculators/Plotters); `calculatorGrid` uses `repeat(auto-fit, minmax(250px, 1fr))` so calculator inputs reflow by available width; the pace calculator's dual-panel-with-swap layout (`1fr auto 1fr`) collapses to a single column under 900px. The homepage hero breaks the column entirely: a centered `aspect-square` 2×2 grid (`min(88vw, 26rem)`) of the four section tiles with the circular QUOP wordmark badge overlapping at its center.

Two custom breakpoints recur throughout (900px, 640px/720px) alongside Tailwind's `sm:` (640px) on newer Tailwind-authored components — both idioms are currently live in the codebase; match whichever a given file already uses rather than introducing a third.

## Elevation & Depth

**The Always-Lifted Rule.** Nothing in this system sits perfectly flat. Every card, input, and button carries a soft ambient shadow at rest and deepens that shadow (plus a small `translateY` lift) on hover or focus. Flatness here would read as unfinished, not minimal — this is a confirmed, deliberate property of the system, not an incidental default to be corrected later.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 20px 50px rgba(31, 41, 51, 0.1)`, day / `0 28px 60px rgba(0, 0, 0, 0.35)`, night): the resting shadow under every `sectionCard`, `inputCard`, and `infoPanel`.
- **Control ambient** (`box-shadow: 0 12px 24px rgba(91, 102, 117, 0.14)`, deepens to `0 16px 28px rgba(91, 102, 117, 0.18)` on hover): the metallic plotter/action buttons (`buttonControl`).
- **Focus ring** (`outline: 3px solid rgba(139, 30, 63, 0.3)`, day / `rgba(244, 185, 66, 0.4)`, night, `outline-offset: 3px`): keyboard focus on links, buttons, and active input containers — uses the ink-accent pair, not a generic blue.

## Shapes

Corners are soft throughout but not uniform: primary buttons and small controls round to `0.8rem`, inputs and secondary surfaces to `0.9–0.95rem`, primary cards to the largest radius at `1.1rem`. Pills (nav items) and true circles (the QUOP wordmark badge, the theme toggle) go fully round (`rounded-full`/`999px`). A 1px hairline border in the sepia/frost neutral appears on almost every container; the one departure is the homepage hero tiles, which add a 3px colored top-edge stripe in a section's wayfinding color — the single place a hard-edged accent line is allowed to appear.

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

### Signature Component — FITS Instrument Readout
The FITS/CSV plotters depart deliberately from the parchment/notebook language into instrument-panel language: a checkerboard "transparency" background behind the rendered frame, a green-phosphor crosshair (`#9cff8f`) with a glowing box marker, a translucent dark mono-font coordinate readout badge (`rgba(12, 18, 14, 0.78)` background, `#b9ffb3` text), and a vertical colorbar strip. Icon-button toolbars use amber highlighting (`rgba(230, 171, 88, 0.16)` background, `#8f5f12`/`#ffd99d` text) for active/open states rather than the primary Oxblood/Amber pair — this toolbar-amber is a separate, narrower accent scoped only to these instrument controls.

## Do's and Don'ts

### Do:
- **Do** preserve the full hue swap on the primary accent between themes (Oxblood Ink ↔ Lamp Amber) — see The Day/Night Ink Rule.
- **Do** give every interactive surface a resting shadow that deepens on hover/focus — see The Always-Lifted Rule. A flat card or button is a bug here, not a style choice.
- **Do** keep the four section wayfinding colors (ember-orange, sky-blue, seafoam-teal, coral-pink) purely categorical — section identification only, never a general accent.
- **Do** reserve uppercase/letter-spaced type for structural labels (kickers, nav, cluster labels) and keep all real content sentence-case — see The Case Rule.
- **Do** route FITS/data-instrument surfaces through mono type and the green-phosphor/toolbar-amber language, keeping them visibly distinct from the parchment chrome around them.

### Don't:
- **Don't** treat `TransitionProvider`, `NavTransitionLink`, `WavefunctionBanner`, or the `orbitalPhase` field on `navSections` as part of the live design system. They exist in source but are not wired into the app (no page imports `TransitionProvider` or `WavefunctionBanner`; `AppShell` uses a plain `Link`, not `NavTransitionLink`; `orbitalPhase` is never read). They're leftover from a prior orbital/atom hero and should be treated as dead code, not incumbent authority, until someone deliberately revives or removes them.
- **Don't** let the Oxblood/Amber ink pair and the section wayfinding colors trade places — they answer "what's emphasized" and "what section is this" respectively, and mixing them removes the only categorical signal the site has.
- **Don't** flatten any card, button, or input to zero shadow at rest — see The Always-Lifted Rule.
- **Don't** mix the two live corner-radius idioms (Tailwind's `rounded-2xl`/`rounded-full` on newer components vs. the hand-set `0.8–1.1rem` scale on older CSS classes) within a single component; match whichever the surrounding file already uses.
