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

**Static, client-side only.** Like everything else on the site, the builder runs
entirely in the browser. Scenes autosave to `localStorage` and export as JSON;
the view exports as a PNG for a lab log.

## Interaction model

| Action | How |
| --- | --- |
| Add a part | Pick it in the palette, click the table |
| Move | Drag it (snaps to 25 mm; hold Shift for 5 mm), or type x/z, or arrow keys |
| Rotate | `R` / `Shift R`, the ±15° buttons, or type a yaw |
| Duplicate / delete | `D` / `Delete` |
| Draw a beam | "Draw a beam path", click parts in order, `Enter` |
| Undo / redo | `⌘Z` / `⇧⌘Z` |
| Cancel anything | `Esc` |

Left-drag pans the table and the wheel zooms; a press that travels more than a
few pixels is a pan, not a click, so panning never drops a component by
accident. The camera is orthographic, locked to an isometric or a top-down
view — a bench is read from above, and free orbit only makes a layout harder to
compare with the real thing.

## Visual language

The panel stays in the site's notebook language: parchment card, uppercase
kickers, lifted surfaces, the oxblood/amber ink accent. The canvas switches into
instrument language, the same way the FITS viewers do — the coordinate readout
is mono and phosphor green, mode badges use the toolbar amber, and the whole
scene swaps from a warm daylit bench to a midnight one with the theme.

## Files

| File | What it holds |
| --- | --- |
| `src/components/builder/types.ts` | Data model, component specs, table geometry, JSON parsing |
| `src/components/builder/use-builder-scene.ts` | Scene state, undo/redo, autosave |
| `src/components/builder/scene-theme.ts` | Day/night scene palettes, bound to `data-theme` |
| `src/components/builder/component-models.tsx` | The 3D part models |
| `src/components/builder/builder-canvas.tsx` | Canvas, camera fit, table, beams |
| `src/components/builder/builder-panel.tsx` | Palette, inspector, beam list, table controls |
| `src/components/builder/builder-scene.tsx` | Orchestration: selection, drag, keyboard, files |

## Known gaps

- A beam can be drawn through a part that would not physically steer it; nothing
  validates the geometry.
- Components can overlap — there is no collision or footprint check.
- Beam colours are free-form, so the mount-colour convention is a convention,
  not something the builder enforces.
- No dimension/ruler annotations between arbitrary points yet.
