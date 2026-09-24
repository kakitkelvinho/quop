# Shading

How the experiment builder's 3D scene is lit and surfaced, and how to change it
without making it look like every other three.js demo.

Companion to `BUILDER.md`, which covers the data model and interaction. This
file covers only how it looks.

> **Supersedes** the September 2026 "matte anodised bench under lab ceiling
> light" plan, which described a warm table, `ambient: 0.85`, and desaturated
> anodised parts. That direction was abandoned in favour of the one below; the
> old plan's stage numbering (1.1–2.4) no longer maps onto anything in the
> code. Its performance rules survive, restated here.

## The target

> White enamel instruments under overhead ring lights, on a seamless studio
> sweep. No table in shot. Day is a bright room; night is the same parts
> floating in a dark void with a cool rim.

The reference is a 2001-era interior photographed as a miniature, not a
catalogue photo of a bench. This is a deliberate stylisation and it is the
thing to protect: the parts are whiter, glossier and cleaner than any real
optomechanics, the table is invisible and catches only shadow, and the
background is a gradient rather than a room.

What it rules out, by construction: bloom, depth of field, a reflective floor,
a visible table edge, an HDRI environment, and emissive glow on anything but
the laser aperture and a cavity's mode. If a change would look impressive in
isolation, it is probably wrong for this scene.

What it does **not** rule out, and this is the correction the rest of this
document is about: **value structure**. White-on-white is a stylisation; no
silhouette at all is a bug.

## The core problem: light mode has no silhouette

Measured from `scene-theme.ts` and `component-models.tsx` as of this writing:

| element | light | L\* | dark | L\* |
|---|---|---|---|---|
| backdrop centre | `#f7f6f2` | 97 | `#2a2c33` | 18 |
| enamel body / pillar | `#fbfbf8` | 98 | `#ecebe7` | 93 |
| `palette.metal` | `#d8dce2` | 87 | `#c9ced6` | 82 |
| `Hardware` (knobs, adjusters) | `#a7aeb8` | 72 | `#6b727e` | 49 |

The parts barely change between themes — only the backdrop flips. Dark mode
therefore gets roughly 15:1 part-to-background contrast and reads beautifully.
Light mode gets **1.03:1** for anything drawn in `Enamel`.

Three things make light mode worse than that number alone suggests:

**The rim light is white.** `rimColor: "#ffffff"` at intensity 1.1. A white rim
on a white part against a white sweep is a no-op. In product rendering the
governing rule is that an edge is defined by *shadow wrapping the silhouette*,
never by a highlight on it — a highlight on the side is precisely what makes a
white object's edge dissolve into a white background.

**The contact shadow is turned down.** `shadowOpacity: 0.16` in light against
`0.5` in dark, and the shadow ink is `#1c2230` — a cool blue on a warm
`#f7f6f2` sweep, which reads pasted-on. In light mode the shadow is the *only*
cue carrying edges, and it is the one running at a third strength.

**The sweep is brightest where the subject is.** `backdrop` runs
`#f7f6f2 → #e4e6ea → #c3c7cf` from centre out, and the vignette darkens the
corners. The parts live in the middle, so both gradients push contrast away
from the subject rather than toward it.

## The value ladder

This is the part to get right. Everything else is tuning.

Each theme needs four separated bands, and the ordering matters more than the
exact numbers:

**Light mode**

| band | target L\* | approx. | note |
|---|---|---|---|
| enamel bodies | 96 | `#f5f4f1` | the identity; stays the brightest thing |
| backdrop centre | 88–90 | `#e2dfd8` | ~8 points below the enamel |
| backdrop edge | 68–72 | `#a8aaae` | |
| pillars / posts | 60–64 | `#9a9ea3` | clearly the darkest neutral |
| contact shadow | — | `#3a352c` @ 0.30 | warm ink on a warm sweep |

**Dark mode**

| band | target L\* | approx. | note |
|---|---|---|---|
| enamel bodies | 93 | `#ecebe7` | unchanged |
| pillars / posts | 60–64 | `#9a9ea3` | the same value as light |
| backdrop centre | 18 | `#2a2c33` | unchanged |
| backdrop edge | 2 | `#020203` | unchanged |

Dark mode is already close to right and needs little beyond the pillar change.

**One pillar value serves both themes.** At L\* ~62 a post sits below the light
backdrop and above the dark one, so it reads as a distinct mid-value vertical
stroke either way. Unlike the enamel bodies — which are near-white in both
themes and therefore only work in one — the posts do not need a light/dark pair.

## Posts are grey, and that is a decision

Every part on the bench stands on a `Pillar`, currently drawn in the same
white enamel as the instrument bodies. That is one invisible vertical stroke
per component in light mode, and it is the largest single contributor to the
scene reading as an undifferentiated white field.

The decision is **neutral mid-grey, not white and not brown.** The reasoning,
because this will come up again:

**Thin elements need more contrast, not less.** A mount plate is 49 mm of
surface; a post is a ~12 mm stroke. Contrast requirements scale inversely with
the size of the element. A white plate at 1.03:1 is soft; a white post at
1.03:1 is absent.

**Dark neutrals recede.** The intuition that darker means more distracting is
backwards for achromatic elements — what draws the eye is saturation and
brightness, not depth. A mid-grey post reads as structure the eye skips over on
its way to the optic, which is what a post is. White posts do the opposite:
same value as the bodies, so they compete for attention while carrying no
information.

**Hue is spent.** Mount tint is the user's channel for marking beam lines (see
`BUILDER.md`), and the real hardware works the same way — LIOP-TEC ships STAR
and PLANET mounts in nine colours specifically so beam paths can be told apart.
Any hue on the posts competes with that. A warm post beside a cool-white body
also reads as wood or plastic rather than metal; stainless is neutral with a
faint cool cast, which is both free and correct.

The cost, stated honestly: a bench of twenty parts becomes a forest of twenty
mid-grey verticals, which is busier than twenty invisible ones. That busyness
is information, and the trade is worth taking. If it ever becomes too much, the
lever is the *number* of posts on screen, not their value.

## The rest of the light-mode fix

In priority order. The first two are most of the win.

**1. Darken the sweep, do not darken the parts.** Pull `backdrop` down to
roughly `["#e2dfd8", "#cfccc4", "#a8aaae"]`. This restores silhouette while
leaving the white-enamel identity completely intact, and it is the smaller and
safer change — the alternative, dropping `body` to L\* 92, dilutes the thing
the direction exists for. Middle grey (18% reflectance) is L\* ~50; the sweep
does not need to go anywhere near that far.

**2. Strengthen and warm the contact shadow.** `shadowOpacity` to ~0.30, and
the shadow ink to something warm like `#3a352c`. On a warm sweep a cool-blue
shadow looks composited rather than cast.

**3. Retire the white rim in light mode.** Either drop `rimLight` toward 0.4,
or give it the cool colour dark mode already uses (`#b9ccff`) so it at least
does work. The separation should come from `occlusion` and the contact shadow,
not from an edge highlight.

**4. Leave the key light alone.** `ambient: 0.2` / `keyLight: 1.6` is a good
ratio and is doing its job: two faces of a plate already read as different
brightnesses. The problem was never the lighting model.

## Ground rules

**Materials go through the helpers.** `component-models.tsx` defines `Enamel`,
`Anodised`, `Glass`, `Stainless` and `Hardware` near the top. Any new mesh uses
one of those rather than an inline `<meshStandardMaterial color="#...">`. This
is what lets shading work and geometry work proceed in the same file without
colliding, and a part added later inherits the shading for free.

Note that `Anodised` is currently an alias for `Enamel` — the name is a
holdover from the matte direction. It is kept because the call sites read
correctly (a mount plate *is* the anodised colour, it is simply rendered as
glossy enamel here), but do not read it as a promise of a matte material.

**Palette lives in `scene-theme.ts`.** The canvas cannot read CSS custom
properties, so every scene colour is a literal there, in a light and a dark
variant. Never hard-code a colour in the canvas that should differ by theme.
The pillar value is the one deliberate exception worth considering, since it is
the same in both.

**Two themes, always.** Every change is checked in both. Light mode is where
value collapse shows up; dark mode is where over-bright hardware does.

## Performance budget

Assume the weakest plausible device: a shared lab Windows box on integrated
graphics, mid-experiment, with a browser full of other tabs.

Nothing renders per frame that does not have to. The scene is static between
interactions, so the frame loop should be idle — `frameloop="demand"` on the
`<Canvas>`, with `invalidate()` where something needs to repaint. `preserveDrawingBuffer`
stays; the PNG export depends on it.

Tone mapping is `NeutralToneMapping`, set explicitly. R3F's default is ACES
Filmic, which is built for film-style HDR content and both washes and darkens a
flat UI-adjacent scene like this one. If tone mapping is ever changed again, do
it *before* re-tuning any colours, or the colour work gets done twice.

Watch transparent overdraw. It is the one real cost already in the scene: the
PBS cube is transmissive glass, plus an internal plane, plus edges, and glass
in front of glass multiplies fill cost. `Glass` uses real `transmission` with
`thickness` and `attenuationDistance`, which is not cheap. If anything ever
needs optimising, look there before anywhere else.

Segment counts are nearly free to reduce and nobody can see the difference at
this zoom. Twenty-four curve segments is plenty.

## Not doing

Bloom, depth of field, SSAO, screen-space reflections, an HDRI environment
file, a reflective floor, a visible table, and emissive glow on anything but
the laser aperture and a cavity's mode. Each is either expensive, or on the
standard list of things that make a render look auto-generated, and most are
both.

## Acceptance check

Screenshot the builder in light and dark at 1440×900 with the default scene.
The tests:

- Every post is visible against the sweep in light mode without squinting.
- Parts sit on the sweep rather than hovering — the contact shadow reads.
- A mount's two visible faces differ in brightness.
- Nothing is pure `#ffffff` or pure `#000000`.
- Nothing glows except the aperture and a cavity mode.
- Greyscale the screenshot: the scene should still be fully readable. If it
  collapses, the value ladder is wrong, not the palette.

Performance check: with the page open and untouched, the frame loop should be
idle. Confirm by watching GPU activity settle to nothing a second after the
last interaction.

## Open questions

Whether the enamel bodies should come down slightly (L\* 96 rather than 98)
once the sweep is darkened, or whether the sweep change alone is enough. Tune
the sweep first and judge.

Whether `Hardware` (`#a7aeb8` light) and the new pillar value should converge
into one neutral. They are doing the same job — non-optic structure — at two
different values, and the split may be a leftover rather than a decision.

Whether 100 mm beam height still reads well once a table has twenty parts on
it, or whether the bench starts to look like a forest. The post-value change
makes this more pressing, not less.
