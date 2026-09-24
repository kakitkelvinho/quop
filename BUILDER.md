# Experiment Builder — design brief

The builder lives at `/experiment/builder`. It is a layout notebook for an
optical table, not a simulator: you place real bench parts on a millimetre
grid, arrange them, and record the route light takes between them.

## Who it is for

Both of QUOP's audiences at once (see `PRODUCT.md`):

- **In the lab** — sketch a setup before touching a post, check that an arm
  physically fits on the board, and get a delay line's path length and time of
  flight without doing the arithmetic by hand.
- **From outside** — an interactive way to see what an optics bench is made of.
  Every part carries a plain-language hint, so nothing requires lab-internal
  knowledge to be legible.

## Decisions

**Real millimetres, everywhere.** The table plane is XZ, +Y is height, one unit
is one millimetre. The board is 800 × 600 mm. Positions snap to a 25 mm grid
(Shift for 5 mm) because that is what a breadboard's hole pattern gives you,
and rotation snaps to 15°. The numbers in the inspector and the readout are the
numbers you would set on a real bench.

**One shared beam height.** Every optic sits at `OPTICAL_AXIS_MM` (22 mm) on a
post. That is how a table actually works — a straight beam has to hit each
element at the same height — and it keeps the drawn beams from zig-zagging in
elevation.

**Beams are drawn, not traced.** A beam is an ordered list of the components it
visits. The builder does not compute reflection or refraction, and deliberately
so: a lab diagram records what you *intend* the light to do, and a half-correct
ray trace would quietly disagree with the setup you are documenting. The cost is
that a beam can be drawn through a part that would not really steer it; the
benefit is that any layout can be expressed, including ones the simulator would
get wrong.

**Path length is the payoff.** Because a beam is a polyline with real
millimetres, its length and vacuum time of flight fall out for free. Both are
shown per beam, which is the number a pump–probe delay line is actually built
around.

**Mount colour marks the beam line.** A mirror mount can be tinted; the
convention is that the tint matches the beam it serves, so a crowded table can
still be read at a glance. This is a user-facing convention, not a design-system
colour — see `DESIGN.md` on keeping the section wayfinding colours out of it.

**Real hardware where it can be seen, schematic where it can't.** Mounts
follow the lab's own catalogues: LIOP-TEC for most parts, Radiant Dyes for the
open-back MARS mirror mount and the rotation mount a waveplate drops into.
Everything on a post stands on one kind of post, a 1-inch pedestal pillar;
a lens stands on a slim rod instead, because a holder would hide the glass.
Parts too small to see at true scale (the sample slab, the Paul trap, a
particle) are drawn larger than life and float at their height.

**A particle lives in a host.** Dropped on a Paul trap or a cavity, a particle
snaps to its centre and moves with it; dragged or nudged clear, it lets go.
The cavity's glowing mode is part of the cavity, not a beam: it counts toward
no path length.

**Static, client-side only.** Like everything else on the site, the builder runs
entirely in the browser. Scenes autosave to `localStorage` and export as JSON;
the view exports as a PNG for a lab log.

## Interaction model

The builder is a full-window workspace: the site nav steps aside and the canvas
fills the viewport. A few small islands float over its edges, and nothing else
is on screen until it is needed:

- **Top left**: "‹ QUOP" back to the site, and the File menu (save/open JSON,
  export PNG, load the example, clear the table).
- **Top centre**: the tool pill (Select, Add, Draw a beam, Undo, Redo). Add
  drops a tray of parts grouped as a bench walk-through. While placing or
  drawing, a mode badge under the pill carries that mode's key hints.
- **Right**: the inspector, shown only while something is selected: a
  component, a beam, or a beam being drawn.
- **Bottom**: the readout (left), one chip per beam with its path length
  (centre; click to select), and the view controls (right).

| Action | How |
| --- | --- |
| Add a part | Add (＋) in the tool pill, pick it in the tray, click the table |
| Move | Drag it (snaps to 25 mm; hold Shift for 5 mm), or type x/z, or arrow keys |
| Rotate | `R` / `Shift R`, the rotate buttons, or type a yaw |
| Duplicate / delete | `D` / `Delete`, or the inspector's buttons |
| Draw a beam | Draw a beam in the tool pill, click parts in order, `Enter` |
| Select a beam | Click its chip along the bottom |
| Undo / redo | `⌘Z` / `⇧⌘Z` |
| Cancel anything | `Esc` (closes the tray, then cancels a mode, then deselects) |

Shortcuts live in button tooltips and in the mode badge, not in a panel of
their own.

Left-drag pans the table and the wheel zooms; a press that travels more than a
few pixels is a pan, not a click, so panning never drops a component by
accident. The camera is orthographic, locked to an isometric or a top-down
view — a bench is read from above, and free orbit only makes a layout harder to
compare with the real thing.

## Visual language

The floating islands, the readout included, stay in the site's notebook
language: surface cards with a hairline border, lifted shadows, the
oxblood/amber ink accent, measured values in mono. Only the transient mode badge
borrows the instrument toolbar amber. An earlier phosphor-green readout was
dropped as jarring against the notebook. A darker, instrument-console look for the islands was tried and
rejected (see the `prototype/builder-panels` branch).

The scene itself is lit like a *2001* interior shot as a miniature (think
Hitman GO): glossy white enamel hardware and saturated enamel mounts under
overhead ring lights, on a soft studio sweep. Day is a white room; night is the
same parts in a dark void with a cool rim light. It was chosen over a PBR bench,
a technical-drawing look and a plain studio render because it reads cleanly in
print — posters, slides and paper figures are mostly white pages.

- **No table in shot.** The breadboard is still there — it is what you click
  and drag on, and it catches the key light's shadow — but it is never drawn.
  Parts are grounded by that shadow and by ambient occlusion instead.
- **Grid on demand.** With no table, the grid is a working aid, not scenery:
  it appears only while a part is being placed or dragged (and the grid toggle
  is on).
- **Enamel, not anodised metal.** Mount plates and bodies are dielectric so
  their colour stays saturated; only posts, screws and mirrors are metal.
- **Real glass.** Optics use physical transmission — refraction, Fresnel
  edges, thickness tint — rather than alpha. One glass part won't show another
  glass part behind it; on a bench that rarely matters.
- **No outlines, no tilt-shift.** Edge lines read as ink on a render, and blur
  hides the parts you are trying to edit.

The render-style exploration that led here is kept on the
`prototype/builder-shading` branch.

## Files

| File | What it holds |
| --- | --- |
| `src/components/builder/types.ts` | Data model, component specs, table geometry, JSON parsing |
| `src/components/builder/use-builder-scene.ts` | Scene state, undo/redo, autosave |
| `src/components/builder/scene-theme.ts` | Day/night lighting and backdrop palettes, bound to `data-theme` |
| `src/components/builder/component-models.tsx` | The 3D part models |
| `src/components/builder/builder-canvas.tsx` | Canvas, camera fit, lighting, backdrop, table, beams, post effects |
| `src/components/builder/builder-hud.tsx` | The floating islands: file menu, tool pill and parts tray, mode badge, readout, beam chips, view controls |
| `src/components/builder/builder-inspector.tsx` | Inspector bodies for a component, a beam, and a beam being drawn |
| `src/components/builder/builder-icons.tsx` | The builder's icon set and icon button |
| `src/components/builder/builder-scene.tsx` | Orchestration: selection, drag, keyboard, files |

## Known gaps

- A beam can be drawn through a part that would not physically steer it; nothing
  validates the geometry.
- Components can overlap — there is no collision or footprint check.
- Beam colours are free-form, so the mount-colour convention is a convention,
  not something the builder enforces.
- No dimension/ruler annotations between arbitrary points yet.
