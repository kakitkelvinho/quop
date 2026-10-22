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
  station-blue: "#1a5fb4"
  station-blue-deep: "#0f4690"
  station-blue-soft: "rgba(26, 95, 180, 0.09)"
  sign-lettering: "#ffffff"
  true-black: "#000000"
  ink-panel: "rgba(10, 10, 10, 0.92)"
  ink-panel-strong: "#111111"
  paper-foreground: "#ffffff"
  cool-gray-muted: "#a1a1a1"
  frost-border: "rgba(255, 255, 255, 0.14)"
  chalk-mark-night: "rgb(255 255 255)"
  station-ring-night: "#4f8dd6"
  station-blue-soft-night: "rgba(26, 95, 180, 0.38)"
  ember-orange: "#ff9d5c"
  sky-blue: "#6da8ff"
  seafoam-teal: "#75d7c0"
  coral-pink: "#f06f86"
typography:
  display:
    fontFamily: "var(--font-source-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4.6rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "var(--font-source-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.25rem, 2.4vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "var(--font-source-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-source-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 800
    letterSpacing: "0.08em"
  readout:
    fontFamily: "var(--font-source-sans), -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 500
    fontFeature: "tnum"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.92em"
    fontWeight: 400
  equation:
    fontFamily: "var(--font-eb-garamond), Georgia, 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 400
    fontStyle: "italic"
rounded:
  none: "0"
  edge: "2px"
  meaning: "999px"
spacing:
  sm: "0.65rem"
  md: "1rem"
  lg: "1.3rem"
components:
  sign-button:
    backgroundColor: "{colors.station-blue}"
    textColor: "{colors.sign-lettering}"
    rounded: "{rounded.edge}"
    padding: "0.6rem 0.9rem"
  sign-button-hover:
    backgroundColor: "{colors.station-blue-deep}"
    textColor: "{colors.sign-lettering}"
    rounded: "{rounded.edge}"
  sign-pictogram:
    backgroundColor: "transparent"
    textColor: "{colors.sign-lettering}"
    rounded: "{rounded.edge}"
    size: "1.6em"
  card:
    backgroundColor: "transparent"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.none}"
    padding: "1.3rem 0"
  input-field:
    backgroundColor: "{colors.paper-surface-strong}"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.edge}"
    padding: "0.8rem 0.9rem"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-foreground}"
    rounded: "{rounded.edge}"
    padding: "0 0.75rem"
  nav-tab-active:
    backgroundColor: "{colors.station-blue}"
    textColor: "{colors.sign-lettering}"
    rounded: "{rounded.edge}"
    padding: "0 0.75rem"
---

# Design System: QUOP

## Overview

**Creative North Star: "The Working Board"**

QUOP reads as a physicist's own working surface, not a software product. By day it's white paper worked over in graphite: plain white ground, hairline borders, blue annotations. By night it's the same room with the lights off and the board lit — true black, chalk-white marks, the same station blue lit as fills and rings around white words, the FITS viewers glowing with green phosphor crosshairs and readouts like an old instrument dial. Nothing here is trying to look like a SaaS dashboard; it's trying to look like a surface someone actually works on.

The homepage states that literally: a board the visitor arrives at mid-session, with equations from four domains being written and wiped behind the welcome. The rest of the site is the notebook the board's results get copied into.

The mood is inviting first, credible second — the site has to work for a visitor who has never touched an optics bench, not only for the labmate who lives at one. Invitation shows up in the hand-drawn marks, the unhurried writing and erasing, and controls that read at a glance as the signs of a station. Credibility shows up underneath: exact values in tabular figures, uppercase structural labels, and instrument-grade FITS readouts that don't soften their numbers for anyone.

Two color systems run in parallel and must not be confused: the station blue is the notebook's *own* ink, by day and by night — used for interactive accents, focus rings, and emphasis text everywhere. The four section colors (ember-orange, sky-blue, seafoam-teal, coral-pink) are a separate, purely categorical wayfinding system — they mark which of the four site sections (Builder, Notes, Plotters, Calculators) something belongs to, though nothing currently renders them (see Status, below). They are tabs on a notebook's colored dividers, not brand accents; don't let them compete with the ink.

**Key Characteristics:**
- White paper by day, black board by night — one station-blue ink in both, worn as fills and rings at night while the words go white
- Every corner is square and hard, as in the builder — one radius, `2px` (an edge break), site-wide; only things round by meaning stay round (see Shapes)
- Whatever can be pressed is a station sign: a square blue plate with white lettering, and any icon on it a white-outlined pictogram in a white-bordered square — see The Sign Rule
- Cards have no frame: no border, no shadow, no fill. Two cards are told apart by one thin gray hairline between them — see The Hairline Rule
- The interface is flat. Depth belongs to the Tabletop's 3D scene, not to the chrome (see Elevation & Depth)
- Uppercase, letter-spaced labels mark structure and category; regular-case text is always actual content
- FITS/data-instrument surfaces (crosshair readouts, colorbars) speak in tabular figures and green-phosphor highlights, deliberately more "instrument" than the plain chrome around them
- Four categorical wayfinding colors (orange/blue/teal/pink) identify site sections; they never substitute for the station-blue ink
- Hand-drawn marks — wobbled card frames, textured chalk strokes, italic serif equations — belong to the homepage board and nowhere else; every other surface is precise

## Colors

One station-blue accent in both themes, a neutral scale that runs to pure white and pure black, and four categorical section colors that stay out of the ink's way.

### Primary
- **Station Blue** (`#1a5fb4`, `--accent`, day and night): the notebook's own and only accent, the blue of an Austrian station sign — every sign plate (every button, the tool index's signs, the homepage's way to the tools, the active header tab, pressed builder controls), the label markers, focus rings by day, calculator result emphasis, the Tabletop's selection. White lettering on it is about 6:1.
- **Station Blue Deep** (`#0f4690`, `--accent-hover`): a sign under the pointer, and a sign that is pressed or open. As `--accent-strong` it is also the darker text step by day, for emphasis text and links where the base ink would be too loud; at night `--accent-strong` is white (`#ffffff`).
- **Sign Lettering** (`#ffffff`, `--on-accent`): the words on a plate, the pictogram's outline and the border of its square, in both themes.
- **Station Ring** (about `#4f8dd6`, night, `--focus-ring`, mixed from `--accent` toward `#8fc4ff` so it follows it): the ink as a thin mark on black — focus rings, outlines, selection borders, ink-coloured icons, the 3D selection ring. About 6:1 on black. By day the ring is the ink itself.
- **Station Blue Soft** (`rgba(26, 95, 180, 0.09)` day, `0.38` night, `--accent-soft`): the faint wash behind a hovered row or a readout — never used as a fill for large areas, and no longer the active state, which is a plate.

**The Day/Night Ink Rule.** One hue in both themes. Fills are unchanged: a blue plate, button or badge is `#1a5fb4` day and night, with white lettering on it. Thin marks lift at night to the lighter Station Ring, where the plate's blue would sink into black. Words are never blue at night: where the ink marks text (a result, a link), the words go white (`--accent-text`, `--accent-strong`) and take their emphasis from size and weight, with the blue in the fill or ring around them. Links keep a 1px underline and turn into a plate on hover. By day, blue text stays.

**The Sign Rule.** The identity is a station's wayfinding: the blue direction signs over a platform, with a nod to HITMAN's label plates in the same colour. **Whatever can be pressed is a sign.** Every button, every control that toggles or opens something, the theme toggle, a file picker's button, a tool card's link, a plotter's action grid (a viewer's icon toolbar is the exception: see The Quiet Toolbar Rule): a square plate in `--accent` with `--on-accent` lettering, day and night. The plate is the affordance, so it is there at rest, not only on hover. **The orange arrow always sits in the sign's lower right corner**, about `0.3–0.7em` in from both edges, pointing the way on (right to a destination, down to the page under the header's current tab); it never leads the words.

- **Plate:** `--accent` fill, no border, no shadow, radius `--radius` (`2px`). Lettering is the Label step (800, uppercase where the Case Rule calls it structure, sentence case where it is a quantity or a name).
- **Hover:** the plate darkens to `--accent-hover` (Station Blue Deep). Nothing lifts, nothing glows.
- **Pressed, open, active:** the plate stays deep and gains a `3px` white bar along its foot (`--on-accent`), inset `2px` from the plate's bottom and sides so a blue edge keeps it from melting into a white page, the platform-number underline of a sign that has been called. A selected item in a group of signs (a segment of a toggle) wears it (the header's current tab has its own mark, below); its unselected siblings are plain plates.
- **Disabled:** the plate keeps its shape and drops to 40 % opacity; the cursor says no. It never turns gray, because a gray plate reads as a different kind of sign.
- **Focus:** the 2px Focus Ring drawn with a `2px` offset, so it sits on the page around the plate rather than on blue it would vanish into.

**The Pictogram Rule.** An icon on a sign is a station pictogram: a white-outlined glyph inside a white-bordered square, the square sitting on the blue plate.
- **The square:** `1.6em` on a side, `1.5px` `--on-accent` border, transparent inside (the plate's blue shows through), radius `--radius` (`2px`). It sits at the leading edge of the plate with `0.5em` between it and the words, the way an arrow box leads a direction sign.
- **The glyph:** drawn as an outline in `--on-accent`, never filled: `1.5px` stroke (scaled to the square, not the viewBox), square line caps and mitred joins, inset about 20 % from the square's border. Lucide-style stroke icons fit it once their caps and joins are set square; a filled icon is redrawn, not inverted.
- **Icon-only signs** (a toolbar button, the theme toggle) are the square alone on a plate that pads it by `0.3em` on every side, so the white border never touches the plate's edge.
- **On a pressed sign** the pictogram does not change; the foot bar carries the state.

**What is not a sign.** A plate means "press here", so nothing that cannot be pressed wears one. Kickers, cluster labels and the beta badge were plates under the old rule; they become uppercase, tracked labels in `--muted` led by a small (`0.5em`) square `--accent` marker, the mark the builder's mode badge already uses. A homepage chapter's status line keeps its own case under the marker, because the Case Rule applies. Inline links in running text stay text — 1px underline, `--accent-strong` — because a paragraph studded with plates is a timetable, not a sentence; they turn into a plate on hover, as before. Fields are not signs either: they are where the user writes, not where they press.

The sign selectors live in one list at the end of `globals.css`, so the gesture stays one gesture. The pictogram is one component, `SignIcon` (`src/components/sign-icon.tsx`), wrapping the repo's inline SVG icons; its CSS (`.signIcon`) strips every fill and sets the stroke, so an existing icon becomes an outline without being redrawn by hand.

**The Tabletop reads the ink, never its own hex.** Every builder use of the accent goes through `--accent`, `--accent-strong`, `--accent-soft`, `--accent-text`, `--accent-hover` or `--focus-ring`, and the 3D scene reads `--focus-ring` from the page (`useScenePalette`) for its selection and hover rings. Changing `--accent` in `globals.css` recolours the HUD and the scene together. A part's own colour saved into a file (`DEFAULT_MOUNT_COLOR`) is data, not theme.

### Section Wayfinding Colors (categorical, not brand accent)
- **Ember Orange** (`#ff9d5c`) — Calculators.
- **Sky Blue** (`#6da8ff`) — Notes. It now sits close to the station-blue ink; revive it as a different hue, or not at all, or it breaks The Divider Rule.
- **Seafoam Teal** (`#75d7c0`) — Plotters.
- **Coral Pink** (`#f06f86`) — Builder.

**The Divider Rule.** These four colors exist to answer "which section is this," nothing else. Do not promote one of them into a general UI accent, and do not let the station-blue ink bleed into a wayfinding role — the two systems answer different questions and must stay visually separable.

**Status: currently dormant.** They survive as the `accent` field on `navSections`, but the only components that read it (`TransitionProvider`, `WavefunctionBanner`) are unwired dead code, so no wayfinding color is visible anywhere in the live app. They were last seen as the 3px top-edge stripe on the old 2×2 homepage hero tiles, which the chalkboard hero replaced. The system is documented here because it is the site's only categorical signal and is worth reviving deliberately — but until something renders it, treat it as a decision pending, not a live rule. The chalk section cards pointedly do not use it: on a board, everything is written in the same hand.

### Neutral
- **Paper White** (`#ffffff`, day) / **True Black** (`#000000`, night): page background. Flat — there is no radial page glow.
- **Paper Muted** (`#fafafa`, day) / **True Black** (`#000000`, night): the second neutral step, used for the chalkboard's radial falloff and for nested surfaces. In dark mode it is identical to the background by design; the board's texture, not a gradient, is what gives the surface depth.
- **Paper Surface** (`#ffffff`, day) / **Ink Panel** (`rgba(10, 10, 10, 0.92)`, night): the nav bar and the flyout panels that float over content, used with backdrop blur on the nav. Cards no longer take it: they sit on the page.
- **Paper Surface Strong** (`#fafafa`, day) / **Ink Panel Strong** (`#111111`, night): opaque surface for inputs and nested panels.
- **Ink Foreground** (`#111111`, day) / **Paper Foreground** (`#ffffff`, night): body text.
- **Slate Muted** (`#666666`, day) / **Cool Gray Muted** (`#a1a1a1`, night): secondary text, leads, captions.
- **Hairline Border** (`rgba(0, 0, 0, 0.12)`, day) / **Frost Border** (`rgba(255, 255, 255, 0.14)`, night): the thin gray line between two cards, the border of an input, and every divider. It is the only line a card ever gets — see The Hairline Rule.
- **Chalk Mark** (`rgb(17 17 17)`, day / `rgb(255 255 255)`, night): exposed as the `--mark` triplet, the colour every hand-drawn stroke on the homepage is mixed from. Strokes never use it at full strength — `--chalk-alpha` (0.26 day, 0.30 night) is the ceiling, and it is the single value most worth re-judging when the hero changes.

## Typography

**Body & Display Font:** Source Sans 3 (with `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`)
**Code Font:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`, the system's own, not shipped — reserved for code: inline `code`, the Tabletop's JSON and AI brief, and the plotters' typed-array inputs. Measured values are not code: they are Source Sans with tabular figures (see Readout).
**Equation Font:** EB Garamond italic (`--font-serif`) — reserved for the equations on the homepage board, which are hand-set HTML rather than KaTeX. Nothing else on the site is set in serif.

**Character:** Source Sans 3, Adobe's open-source sibling of Myriad, carries the whole interface, the Tabletop HUD included, so the brand speaks in one sans. It sits in the humanist signage tradition of Frutiger and the station boards it echoes. It sets smaller than a grotesk, so the root font size is `106.25%`. One variable file (200–900) is self-hosted in `src/app/fonts`. There's no separate display face. Size and weight do the work of hierarchy. Two faces depart from it, each scoped tightly: mono where the content is code, and Garamond italic where the content is a physicist's handwriting.

### Hierarchy
- **Display** (400, `clamp(2.2rem, 5vw, 4.6rem)`, line-height 1.02, letter-spacing -0.03em): the `h1`s of the homepage and the section index pages — one per page, tight and large, and light, because at that size weight shouts. The homepage's chapter headings (`chapter__heading`) stay light with it: they are the board's story, not a working sheet. On calculator and plotter pages every heading — the `toolTitle` `h1` and the `h2`s — is set bold (700), since those pages are working sheets with no frames left to group them.
- **Headline** (700, `clamp(1.25rem, 2.4vw, 1.9rem)`, line-height 1.15): `h2`s inside cards and sections. Bold, because with the card frames gone a heading is what tells one group from the next; at 400 it read as a large paragraph.
- **Body** (400, 1rem, line-height 1.6): running copy. Lead paragraphs step up to `1.08rem` in the muted color, capped at `44rem` measure.
- **Label** (800, `0.75–0.84rem`, letter-spacing 0.08em, uppercase): sign lettering on buttons, header tab text, and the structural labels (kickers, cluster labels) — the first two on a plate, the labels in `--muted` behind a small square `--accent` marker (see The Sign Rule).
- **Readout** (500, `0.72–0.78rem`, Source Sans with tabular figures, `tnum`): FITS crosshair coordinates, colorbar labels and ticks, header values, the Tabletop's lengths, counts and key caps. Lighter than the words round it, so a column of numbers reads as data rather than shouting; tabular figures keep the digits lined up the way mono did.
- **Result** (800, `clamp(2rem, 5vw, 3.2rem)`, line-height 0.95, letter-spacing -0.04em): the one place numbers get genuinely large: every calculator's answer, through the shared `Readout` (`readout--primary`) or, on a converter, inside both linked fields, with tabular figures, a few significant figures and an SI prefix (`1.00 mJ`, never `1.000000e-3 J`). Secondary answers step down to one small muted line under it (`readoutAside`). A tool page's own heading (`toolTitle`, 700, `clamp(1.8rem, 3.4vw, 2.5rem)`) sits below Display, so the answer, not the tool's name, is the largest thing on it.
- **Equation** (400 italic serif, `1.5–1.8rem`): the board's drifting equations. Sized per equation rather than by a scale step, because the shorter ones need to be larger to hold the same visual weight.

### Named Rules
**The Case Rule.** Uppercase + letter-spacing means "this is structure/category," never body content. If it's something the user typed or a real physical quantity, it's sentence case and proportional type; if it's a label the interface itself is asserting, it's uppercase and tracked.

## Layout

The page is a single centered column: `max-w-6xl`, `px-4`/`sm:px-6`, `pt-8 pb-16`, sitting under a sticky, blurred nav bar (`backdrop-filter: blur(14px)`) that never scrolls away. The nav itself is a three-column grid (`1fr auto 1fr`) — left links, centered wordmark, right links — with hover-revealed dropdown panels beneath section labels.

Content grids adapt per surface: `toolGrid` lists a section's tools on its index page (Calculators, Plotters) as rows, not a grid of tiles: a handful of tools of one kind, read down one line while hunting for a name, is a list, and an even grid of identical tiles is a parked domain's look. Each row is the sign with its sentence beside it from 720px (under it below), and there are no hairlines: the plates and the room between them separate the tools, as signs along a platform do; a calculator page is one flat column (`calculatorSheet`, up to `36rem`) at every width: its fields, then, where a tool has a separate answer, a hairline (`--border`) and the result. There is no grid of direction cards and no pace dual panel: converters are two linked fields stacked (see Inputs / Fields). The homepage is the chalkboard hero (`min-height: clamp(400px, 66vh, 640px)`, centered welcome copy) followed by the four chalk section cards, which run `1fr` / `2×` / `4×` at 0 / 640px / 1000px.

Two custom breakpoints recur throughout (900px, 640px/720px) alongside Tailwind's `sm:` (640px) on newer Tailwind-authored components — both idioms are currently live in the codebase; match whichever a given file already uses rather than introducing a third.

## Elevation & Depth

**The Flat Sheet Rule.** The interface is flat. No card, button, input, panel or menu carries a `box-shadow` or a hover lift (`translateY`). This replaces the old Always-Lifted Rule: once cards lost their frames and buttons became signs, a soft floating shadow was the one thing left that looked like a generic SaaS card, and a sign on a station wall doesn't float. Hierarchy is carried by the hairline, the plate and type size, not by fake depth. Depth is reserved for the one place it is real: the Tabletop's lit 3D scene.

**Surfaces that float over content** — the nav bar, the nav flyouts, the plotters' popovers, the Tabletop HUD — are separated from what is under them by an opaque (or blurred, on the nav) fill and a 1px hairline, never a shadow.

**The chalk card family** is flat for its own reason: the homepage's four section cards are a wobbled SVG frame drawn onto the page surface, with no fill and no box. A mark on a board has nothing to cast a shadow with. They are the one card that keeps a frame, because the frame is a drawn line, not a border; the scope is `.chalkCard` and nothing else.

**The Tabletop HUD** is drawn on the glass, not set on the table: flat, opaque, square, no shadow. Under it is a lit 3D scene with its own hard light and real cast shadows, and a second, fake depth competed with it. So every builder surface (islands, menus, the Show wheel and the corner fans, panels and their bars, the panel rail, the cheat sheet, coach marks, labels, badges and the status toast) has no `box-shadow`, no `backdrop-filter` and no `drop-shadow` filter, and an opaque fill (`--surface-strong`, a solid near-black at night). Separating a plate from the scene is done by a clear 1px hairline (`--builder-hairline`, `color-mix(in srgb, var(--foreground) 22%, transparent)`), which stays visible on the night void. The only inset rings left are state, not depth: the active part tile's and the active swatch's. The builder was the first part of the site to go flat and square; the rest of the site now follows it.

Inside the HUD the accent is spent only on what is live: the active tool is a solid `--accent` fill with a white icon, the selection keeps its `--focus-ring` border, and the mode badge carries a small square `--accent` marker. Hovers are a neutral wash (`--builder-hover`, `color-mix(in srgb, var(--foreground) 8%, transparent)`), never `--accent-soft`. A rail slot whose list is showing is pressed in with that neutral wash and a foreground bar along its foot, not the accent; it takes the accent only while the mode it started is live. A corner fan's current wedge (the camera's view, an open panel) is the one place `--accent-soft` fills, because it marks state rather than hover. **The HUD is one of the Sign Rule's two exceptions** (the viewers' icon toolbars are the other, see The Quiet Toolbar Rule)**:** its buttons stay neutral plates at rest and become signs only when pressed or open, because a scene ringed with eleven blue plates would bury the table — see The Minimal HUD Rule. Its pictograms still follow the Pictogram Rule once a button is lit.

### The Hairline Rule
A card is content grouped on the page, not a box. It has no border, no shadow, no fill and no radius; its padding runs top and bottom only (`1.3rem 0`), so its text lines up with the page column. Where two cards meet, **one** thin gray hairline (`1px`, `--border`: Hairline Border by day, Frost Border by night) runs between them, edge to edge of the column. Nothing runs above the first card or below the last: the page's own edges and headings close the group. In a two-column grid the hairline runs between rows, and a vertical hairline between the columns, never a box around each cell. The tool index is the exception: its cards are signs, which separate themselves, so it has no hairlines.

This is the calculator sheet (#261) made general: `sectionCard`, `inputCard`, `infoPanel`, `toolCard` and the plotters' panels all follow it, the interactive chart included: the plot's own frame (`interactiveChart__stage`) is the only box, with no second border or fill around the plot and its toolbar. A card that needs to stand out does it with a heading or a sign, not a frame.

### Shadow Vocabulary
There is none. What's left of the old vocabulary:
- **Focus ring** (`outline: 2px solid var(--focus-ring)`, the ink as a thin mark: Station Blue `#1a5fb4` by day, Station Ring `#4f8dd6` by night): keyboard focus everywhere, from a zero-specificity `:where(:focus-visible)` default, so nothing falls back to the browser's blue. Offset `2px` from a sign, so it reads on the page around the plate; header items draw it inset. Solid rather than a soft wash, because a focus indicator needs 3:1 against the page.
- **Hairline** (`1px solid var(--border)`): between cards, under the nav, around inputs and floating panels.

## Shapes

**The Square Rule.** Every corner is square and hard, as in the builder. One radius, `2px` (`--radius`, which `--builder-radius` follows), for every button, sign, pictogram square, card, input, select, menu, flyout, popover, badge, tooltip, chart frame and toast, on every page. The old soft scale (`0.8rem` buttons, `0.95rem` inputs, `1.1rem` cards, `999px` pills) is retired, and so are Tailwind's `rounded-*` utilities on newer components: a component that uses them is a bug here. The `2px` is an edge break, not a rounding: the 1 mm a machinist eases off a plate's corner so it doesn't cut. It reads as square at a glance and softens only up close; anything you'd notice as round is out.

Only things round by meaning stay round (`999px`): a colour dot (a beam's, a group's), a colour swatch or picker, a radio button's dot, the Show wheel's and the corner fans' ring geometry, and a physical part that is round in the 3D scene. A frame's dot is square because a frame is. "Softer looks friendlier" is not a meaning.

The chalk section cards are the one shape the rule doesn't reach, because their edge is a hand-drawn line with gapped corners rather than a box — see the Chalk Section Cards component.

## Components

Buttons, cards, and inputs are precise and instrument-like: numbers are exact, controls read at a glance as signs, and interaction feedback (a darker plate, a foot bar, a ring) is immediate rather than decorative. The warmth lives in the palette and the board, not in soft corners or playful component behavior.

### Buttons
Every button is a sign (see The Sign Rule and The Pictogram Rule): a square `--accent` plate, white lettering, a white-outlined pictogram in a white-bordered square where it has an icon.
- **Primary** (`buttonLink`): a sign, `0.6rem 0.9rem` padding, Label lettering. Hover deepens to `--accent-hover`; no lift. The homepage's chapters' calls to action are these signs, with the orange arrow (`.signArrow`) in the lower right corner like every sign, not a pictogram leading the words. The ghost variant is retired with the metal one.
- **Action grid** (`buttonControl`, the plotters' and calculators' data actions): signs too. The neutral-metal gradient (`#d7dbe2 → #bcc3cd`) is retired: it read as hardware, but next to blue signs it read as a disabled one. Its secondary variant is gone with it; where an action is genuinely secondary it is a text link, not a paler button.
- **Icon toolbars** (every viewer's tools: the CSV, Array and CSV + FITS charts and the FITS image viewer): **The Quiet Toolbar Rule.** The Sign Rule's second exception, after the Tabletop HUD: a row of blue plates beside a plot outshouts the data. A tool is its pictogram alone, with no plate: the outlined glyph in its outlined square, both in `--muted` gray. Pointed at, it takes the neutral wash (`--foreground` at 8 %) and its line turns to `--foreground`. On, open or pressed, the line is `--foreground` (black by day, white by night) and thickens from `1.5px` to `2px`, so the state never rests on a colour change alone. Disabled is 40 %; focus is the Focus Ring at a `2px` offset. The old toolbar-amber active state and the white foot bar are retired here. **The last tool is an i** (`ChartInfo`, `chart-info.tsx`), after a divider: it opens a bubble that says in words what the pointer does on that plot (drag to zoom on x, Shift + drag or drag the y axis for y, scroll once scroll zoom is on; on the FITS image, point to read a pixel, drag a box, click to pick the slice; on the surface, drag to turn, right-drag to move, scroll to zoom). The bubble opens above the toolbar from its right edge, over the foot of the plot: `--surface-strong`, a `1px` hairline, `--radius`, no shadow, `0.84rem` text with the gesture in 700. Esc, a click outside or the i closes it, and the i is pressed while it is open. It replaces the row of wordless gesture glyphs that sat under every chart.
- **Header items** (`NavItem`, the wordmark, the theme toggle): square tabs the full height of the bar, transparent at rest, a sign on hover (the flyout's links too), and a deep sign (`--accent-hover`) when they are the current section, which carries, in place of the foot bar, a small orange down arrow (`#fb8c4a`, `0.7rem`, `0.3rem` in from the lower right corner, where a station sign keeps its arrow) pointing to the page under it. In the phone's menu sheet the current row is the plate alone, with no arrow, because the page isn't under it there. They are the one control that is not a plate at rest, because a bar of six blue plates would be a departure board, not a header. The theme toggle is the header's last item on every screen, its sun or moon a pictogram once it is lit.

### Cards / Containers
- **Frame:** none. No border, no shadow, no fill, radius `0` — see The Hairline Rule.
- **Separator:** one `1px` `--border` hairline between two cards, never around one.
- **Internal Padding:** `1.3rem` top and bottom, `0` at the sides, with `0.85rem` gap between internal stacked elements.
- **The label:** an uppercase, letter-spaced structural label (`sectionCard__kicker`), muted, behind a small square `--accent` marker, may label a group of controls. It never sits above a heading: the heading carries its own weight. It is not a plate, because it cannot be pressed.
- **The hero's way to the tools** (`heroTools`, on the homepage): one station sign, after Vienna Hbf's overhead panels: a single blue panel `22rem` wide with a row per destination (Tabletop, Plotters, Calculators), each row's name set left at `1.05rem` 800 and its orange right arrow (`#fb8c4a`) in its lower right corner, the rows parted by a faint white rule (`--on-accent` at 22 %). Only the panel's outer corners take `--radius`. Each row is its own link and deepens on hover on its own.
- **Tool rows** (`toolCard`, on index pages) are a station sign and one sentence, after ÖBB's platform signs. The tool's name is on a long, low plate in ÖBB's 6:1 (`aspect-ratio: 6 / 1`, from their 99 × 16.5 cm sign), `26rem` on every row, centred across it and set a little above the middle (`0.2em` above, `0.65em` below, `3.6em` either side so it clears the marks; a name too long for one line grows the plate). The marks sit in the lower right corner: the tool's own pictogram in its white square (`tool-pictograms.tsx`, through `SignIcon`), then the orange arrow (`#fb8c4a`, about 3:1 on the blue: a mark to see, not words to read; the same day and night) as tall as the square, both at `0.85em` of the name so they read at a glance. There is no preview picture: a thumbnail of the tool's output was tried and dropped as clutter. Beside the sign, in muted text, what the tool does. The whole row is one link and takes the neutral wash on hover. There is no other per-card button.

### Inputs / Fields
- **Style:** a square, hairline-bordered outer container (`field__control`, radius `--radius`, Hairline/Frost border) housing a borderless inner `input`/`textarea` on Paper-Surface-Strong background; a unit label sits inline at the end in muted color. A unit picker is a `select`, square, bordered like the field — a field's part, not a sign.
- **File input** (`FileDrop`): the one dashed-border treatment in the system (`1px dashed`, square), signaling "drop a file here" distinctly from typed fields. Its "choose a file" button is a sign with an upload pictogram. It names the file it was given rather than the browser's "No file chosen".
- **Focus:** the ink-accent Focus Ring (see Elevation & Depth), not a border-color change.
- **Linked fields** (`LinkedFields`, on the energy ↔ wavelength, light travel and pace calculators): one field per quantity, stacked, linked as in a unit converter. The field typed in last is the source and is never reformatted; the other is worked out from it and written in (5 s.f. for energy/wavelength, 6 for light travel, pace to the second), or emptied to a muted `—` placeholder when the source isn't a value. Both numbers are set at the Result step inside the input, the label small and muted above, the unit (or one unit picker per field, in the ink colour, white at night) beside. Changing a unit keeps the physical quantity. A visually hidden polite live region announces the worked-out field once typing pauses. The pure logic is `linked-pair.ts`.
- **Side answers** (`readoutAside`): smaller answers under a calculator's main `Readout` share one small muted line (`Pulse energy 1.00 mJ · Peak fluence 2E/(πw²) 0.0637 J/cm²`), values in body colour, formula labels kept.

### Navigation
- Sticky, blurred, three-column nav of square tabs; hovering a tab makes it a sign, and the current section is a deep sign with the small orange down arrow (see Header items). Hovering a section reveals its links in a square flyout panel: Paper Surface, a 1px hairline, no shadow. The links inside are rows separated by hairlines, each a sign on hover.

### Chalkboard Hero (homepage)
The board fills the top of the homepage and inherits the page background, so it is not a panel sitting on the page — it *is* the page, given a surface. Three layers stack under the welcome copy: a canvas of procedural grain (a faint radial falloff from `--background` to `--background-muted`, fine speckle, and long fibres); a canvas reserved for eraser ghosts, which is empty at a `BOARD_HISTORY` of 0 and fills with wipe arcs and illegible earlier working as it is raised; and the chalk layer where equations are written.

Four equations, one per domain — electromagnetism, classical mechanics, statistical mechanics, quantum mechanics — cycle through ten fixed slots around the edge, two on screen at a time by default. Each is clipped in from the left over 1.6s (the writing), holds 8–13s, then fades (the wipe). They are hand-set HTML in Garamond italic, not KaTeX: none of the four needs a fraction or an integral, so the dependency would buy nothing and the text stays selectable. The quantum one carries the ink accent; the other three are graphite.

**The Quiet Centre Rule.** The chalk layer is masked by a radial gradient so marks dissolve before they reach the welcome text rather than colliding with it. Any new equation slot must respect that mask; do not solve an overlap by moving the welcome copy.

Everything the eye judges is a named constant at the top of `chalkboard-hero.tsx` (`ON_SCREEN_AT_ONCE`, `BOARD_HISTORY`, `HOLD_MS`, `RESPAWN_MS`, `SEED`, the equation and slot tables) or a CSS token (`--mark`, `--chalk-alpha`, `--chalk-dust`, `--chalk-filter`). Tuning belongs in those two places and nowhere else.

### Chalk Section Cards (homepage)
Four cards — Builder, Notes, Plotters, Calculators — each a hand-drawn frame around a glyph, a name, a one-line tag in muted text, and the route at the foot, in tabular figures. The frame is four wobbled SVG edges with a gap at each corner, seeded per card so no two are identical, drawn on with `stroke-dasharray` when the card scrolls into view; the glyph and text follow on a short stagger. Hover darkens the frame and turns the name to the ink accent. These cards are flat like every card, and keep the one drawn frame on the site — see Elevation & Depth. They are links but not signs: the board is the one surface written in chalk rather than lettered on plates, and a blue plate on it would break the single idea the homepage is built on. They carry the route instead of an uppercase label, because a route is a real value and the Case Rule applies.

### Signature Component — FITS Instrument Readout
The FITS/CSV plotters depart deliberately from the notebook language into instrument-panel language: a checkerboard "transparency" background behind the rendered frame, a green-phosphor crosshair (`#9cff8f`) with a glowing box marker, a translucent dark coordinate readout badge (`rgba(12, 18, 14, 0.78)` background, `#b9ffb3` text), and a vertical colorbar strip. The phosphor language is for what the instrument *shows* — the frame, the crosshair, the readout. What the user *presses* around it is quiet: the icon toolbar is a row of plateless pictograms under The Quiet Toolbar Rule (see Buttons), and the toolbar-amber active state it used to have is retired.

### Tabletop HUD (the builder)
The controls over the Tabletop's 3D scene are a compact, hard-edged instrument panel, flat by exception (see Elevation & Depth). They have their own scale, set in the builder section of `globals.css`.

**The Minimal HUD Rule.** In the spirit of a game's pro HUD, and against the clutter of GIMP or Inkscape, the HUD shows only what is needed at rest, and related controls sit behind one button each. At rest there are eleven: the QUOP mark, the +, the dock (undo, the eye, redo), the ?, the camera, the day/night switch, and the panel rail's three slots. Help (the guide, the cheat sheet, the AI brief) is one ? away rather than in everyone's face; Select has no button, since it is the resting state and Esc returns to it. A new control joins a fan or the rail before it earns a place of its own.

- **Layout:**
  ```
  QUOP ▾                 [↶  ◉  ↷]                 [?]
  [+]
                 BEAM ▪ Click stop · Enter done          (only while in a mode)

  [≡ ▭ ⊞]                                    [cube] ☾
  ```
  - Top left: the QUOP mark (the wordmark, `0.8rem` 800, tracked `0.14em`, and a ▾) is the file menu, as a logo menu is: Home · .json · .png · Example · Clear. The + under it adds: Part · Beam · Frame · Cable; it lights while adding is live and, pressed again, stops it.
  - Top centre: the dock, one island of undo, the eye (the Show wheel) and redo. The eye is in the middle so its wheel drops symmetrically. The mode badge and the cheat sheet hang under it.
  - Top right: the ? (an info icon): Guide · Keys · AI brief. The inspector opens below it, at `top: 3.9rem`.
  - Bottom right: the camera, showing the current view's icon (iso cube or top): Fit · Top · Iso. Right of it, outside the camera's ring, the day/night switch: a plain icon button with no plate, so it reads as the page's switch, not a table tool.
  - Bottom left: the panel rail, three fixed slots (Beams, Frames, Groups) with their counts in `0.6rem` figures in the corner. The lists stack up from it like windows over a taskbar. An empty slot creates: a small + in place of its count, dimmed to 45 % until pointed at, its tooltip naming the action.
- **Corner fans:** the one menu idiom. Every menu is a quarter fan from a workspace corner, flush with the screen edges, its hole clear of the islands in that corner (the QUOP and + fans lie on one ring). The band is about `150px` deep, thinning to a `64px` floor on a small screen. Wedges are petals: a `6px` gap at the hole that widens outward. Each holds a `24px` icon and one word at `13px` 700 (a file format in sentence case, `.json`), with no hints; the longer hint is the tooltip. Hover and focus are the neutral wash; Clear tints orange (`#c2410c` day, `#fb8c4a` night), never the accent; a disabled wedge drops to 35 %. One fan is open at a time.
- **List panels** (Beams, Frames, Groups) have no window chrome: no grip and no maximise, the title muted at 600, and one small minimise on the right of the bar; the rail brings a minimised list back. Row names are 500. A row's eye and bin show only on hover or focus (on a device that hovers), and a hidden row keeps its closed eye.

- **Radius:** `--builder-radius`, which follows the site's `--radius` (`2px`, The Square Rule), for every island, button, input, menu, panel and its bar, label, badge, key cap, coach mark and the status toast. Only things round by meaning stay round (`999px`): a beam's or group's colour dot, the colour swatches and colour pickers, and the wheels' ring geometry. A frame's dot is square because a frame is. The corner fans' petals are drawn paths and keep their sharp tips.
- **Plates:** opaque `--surface-strong` with a 1px `--builder-hairline` border. One plate inverts to the page's ink (`--foreground` fill, `--background` text: dark by day, light at night): the status toast. The mode badge has no plate at all: its words sit straight on the glass in `--foreground`, since a solid ink slab read as a white box glaring off the night void.
- **Type:** set in the site's **Source Sans 3**, like every other page, so the Tabletop and the notebook speak one voice; numbers are its tabular figures at a lighter weight, and only the JSON and AI brief are mono, because they are code. Smaller than the rest of the site, because the scene is the content.
  - Base `0.82rem` / 1.35: the workspace, inputs, menu items.
  - Titles `0.92rem` 700: the inspector's head, a panel's title.
  - Rows `0.8–0.84rem` 600: a part's name, a group item, buttons; a list row's name `0.8rem` 500.
  - Small `0.72–0.75rem`: hints, panel bar titles (a list's muted, at 600), the cheat sheet, readouts (`0.75rem`, 500).
  - Labels `0.62–0.68rem` 600–800: field labels (sentence case); list and group titles uppercase, tracked `0.04–0.08em`.
  - Key caps `0.6–0.62rem` 500, tabular.
  - Metric values `0.95rem` 500, tabular.
  - Mode badge: the name `1.1rem` 700, uppercase, tracked `0.18em` (BEAM, FRAME, GROUP), after a `0.6rem` square `--accent` marker; its key hints `0.75rem` in sentence case.
  - Status toast `0.8rem` 600.
- **Coach marks:** rings and leader lines in `--focus-ring`, so a thin mark clears 3:1 at night; tags on an `--accent` fill with light words; the card a flat dark plate with a white focus ring.

## Do's and Don'ts

### Do:
- **Do** keep one station-blue ink in both themes: fills unchanged, thin marks lifted lighter, words white at night — see The Day/Night Ink Rule.
- **Do** cut every corner square — radius `2px` (`--radius`) everywhere, `999px` only for things round by meaning — see The Square Rule.
- **Do** make whatever can be pressed a sign: a square blue plate with white lettering, its icon a white-outlined pictogram in a white-bordered square, through the one list in `globals.css` — see The Sign Rule and The Pictogram Rule. The Tabletop HUD, the viewers' icon toolbars (The Quiet Toolbar Rule) and the homepage's chalk cards are the scoped exceptions.
- **Do** separate two cards with one thin gray hairline and nothing else — see The Hairline Rule.
- **Do** keep hand-drawn texture on the homepage board and off everything else — the chalk filters, the wobbled frames, and the serif italic are one scoped gesture, not a site-wide style.
- **Do** keep the four section wayfinding colors (ember-orange, sky-blue, seafoam-teal, coral-pink) purely categorical — section identification only, never a general accent.
- **Do** reserve uppercase/letter-spaced type for structural labels (kickers, nav, cluster labels) and keep all real content sentence-case — see The Case Rule.
- **Do** route FITS/data-instrument surfaces through tabular figures and the green-phosphor language, and keep mono for code alone, keeping them visibly distinct from the plain chrome around them.

### Don't:
- **Don't** treat `TransitionProvider`, `NavTransitionLink`, `WavefunctionBanner`, or the `orbitalPhase` field on `navSections` as part of the live design system. They exist in source but are not wired into the app (no page imports `TransitionProvider` or `WavefunctionBanner`; `AppShell` uses a plain `Link`, not `NavTransitionLink`; `orbitalPhase` is never read). They're leftover from a prior orbital/atom hero and should be treated as dead code, not incumbent authority, until someone deliberately revives or removes them.
- **Don't** raise `--chalk-alpha` until the marks read as confidently as interface text. They are meant to sit at the edge of legibility; an equation that competes with the welcome copy has been pushed too far.
- **Don't** let the station-blue ink and the section wayfinding colors trade places — they answer "what's emphasized" and "what section is this" respectively, and mixing them removes the only categorical signal the site has.
- **Don't** give a card a border, a fill, a shadow or a radius beyond `--radius`, or a button a shadow or a hover lift — see The Flat Sheet Rule and The Hairline Rule.
- **Don't** put a plate on anything that can't be pressed. A blue plate promises a press; a label, a tag or a badge wears the small square marker instead.
- **Don't** fill a pictogram or round its square. It is a white outline in a white-bordered square, the way a station draws it.
- **Don't** use a gray or metal button. A control that can be pressed is blue; one that can't be pressed right now is a blue sign at 40 %.
