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
is one millimetre. The table has no edge: a layout is as large as its parts
make it. A guard 5 m out from the origin only stops a runaway drag. Positions snap to a 25 mm grid
(Shift for 5 mm) because that is what a breadboard's hole pattern gives you,
and rotation snaps to 15°. The numbers in the inspector are the
numbers you would set on a real bench.

**Height per component, 100 mm by default.** Every component has its own
height: its optical centre above the breadboard, in mm. A new part lands at
the lab's beam height, 100 mm, the height its posts are cut for. Raising or
lowering a part changes the length of its post (or the plates a laser stands on); the part
itself never scales. The lowest height is where the post runs out, or where a
floating part meets the table; the ceiling is 300 mm. The spectrometer is the
exception: its input port is fixed by the instrument. A beam between parts at
different heights slopes, and its path length and time of flight are 3D.

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

**Beams can be told apart.** Each beam has its own width (a drawn diameter in
millimetres, 0.5–10 mm, 2 mm by default, so it scales with the zoom like the
parts) and opacity (10–100%), set with the sliders in its inspector. A
selected beam is drawn fully opaque with a stronger halo, however faint it
is, so clicking its chip always finds it.

**Glow only.** A view toggle in the top toolbar draws every beam as its soft
halo alone, with no crisp core line and no arrows, closer to how a laser
really looks and quieter on a busy layout. The halo is stronger then, and
still follows each beam's width and opacity. The beam being drawn keeps its
core and arrows. Like Posts and Grid, it is not saved.

**A mirror in a beam angles itself.** A mirror that is a stop in the middle
of a beam (not its first or last) turns so its face bisects the directions to
the stops before and after it, and re-angles live as any of the three moves.
Its yaw is then read-only in the inspector, and `R` does nothing. If two beams
pass through it, the first in the beam list wins, and the inspector names it
("Angle set by …"). A mirror on no beam, or only at a beam's end, turns by
hand. Beam splitters always turn by hand.

**Mount colour marks the beam line.** A mirror mount can be tinted; the
convention is that the tint matches the beam it serves, so a crowded table can
still be read at a glance. This is a user-facing convention, not a design-system
colour — see `DESIGN.md` on keeping the section wayfinding colours out of it.

**Real hardware where it can be seen, schematic where it can't.** Mounts
follow the lab's own catalogues: LIOP-TEC for most parts (the mirror mount is
drawn from the lab's own LIOP-TEC kinematic mount), Radiant Dyes for the
rotation mount a waveplate drops into.
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

- **Top left**: "‹ QUOP" back to the site, the + that opens the parts panel,
  and the File menu (save/open JSON, export PNG, load the example, clear the
  table).
- **Left**: the parts panel, shown while the + is on: every part with its
  icon and one-line hint, grouped as a bench walk-through, with a search box
  on top. It stays open while placing, so a run of parts goes down without
  reopening it.
- **Top centre**: the tool pill (Select, Draw a beam, Undo, Redo). While
  placing or drawing, a mode badge under the pill carries that mode's key
  hints.
- **Right**: the inspector, shown only while something is selected: a
  component, a beam, or a beam being drawn.
- **Bottom**: one chip per beam with its path length (centre; click to
  select), and the view controls (right). There is no readout: the inspector
  and the chips already carry every number worth reading, and the corner box
  that repeated them was dropped.

| Action | How |
| --- | --- |
| Add a part | ＋ at the top left, pick it in the panel (or search, then `Enter`), click the table |
| Move | Drag it (snaps to 25 mm; hold Shift for 5 mm), or type x/z, or arrow keys |
| Raise / lower | Type a height in the inspector (Enter or leaving the field applies it) |
| Rotate | `R` / `Shift R`, the rotate buttons, or type a yaw (not a mirror in the middle of a beam: it angles itself) |
| Duplicate / delete | `D` / `Delete`, or the inspector's buttons |
| Draw a beam | Draw a beam in the tool pill, click parts in order, `Enter` |
| Select a beam | Click its chip along the bottom |
| Edit a beam's path | Select it; in its stop list, move a stop up or down or remove it (a beam keeps 2 stops). **Add stops**, then click a part to insert it into the segment it sits nearest, or past an end to extend the beam; `Enter` / `Esc` to finish |
| Undo / redo | `⌘Z` / `⇧⌘Z` |
| Cancel anything | `Esc` (stops placing, then closes the parts panel, then cancels a beam, then leaves Add stops, then deselects) |

Shortcuts live in button tooltips and in the mode badge, not in a panel of
their own.

Left-drag pans the table and the wheel zooms toward the cursor; a press that
travels more than a few pixels is a pan, not a click, so panning never drops a
component by accident. Middle-drag, right-drag or Shift + left-drag on empty
table orbits, CAD-style, about the point under the cursor when the drag starts
(the part there, or else the table), so a Magic Mouse can orbit too. Shift +
drag on a part still moves it on the fine grid. A faint hint in the top-right
corner lists these. The camera is orthographic. It orbits a full turn as a
turntable (up stays up) but never dips below the table, and Iso / Top jump straight back
to the isometric or top-down view (no animation). Placing and dragging still
work from any angle: they land on the table plane.

## Visual language

The floating islands stay in the site's notebook
language: surface cards with a hairline border, lifted shadows, the
oxblood/amber ink accent, measured values in mono. Only the transient mode badge
borrows the instrument toolbar amber. A darker, instrument-console look for the islands was tried and
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
  is on), follows the view and fades with distance.
- **Fit frames the parts.** Fit, a change of view and loading a scene frame the
  parts themselves, tall ones and their tags included; an empty table frames an
  800 × 600 mm board. The key light's shadows follow the layout too.
- **Enamel, not anodised metal.** Mount plates and bodies are dielectric so
  their colour stays saturated; only screws, rods and mirrors are metal.
- **Grey posts.** Pillars, pedestals and risers are one mid-grey in both
  themes, so each post reads as a stroke against the sweep instead of vanishing
  into it. Why, and the rest of the value structure: `SHADING.md`.
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
| `src/components/builder/builder-hud.tsx` | The floating islands: file menu, tool pill, mode badge, beam chips, view controls |
| `src/components/builder/builder-parts-panel.tsx` | The parts panel: grouped parts with icons and hints, and search |
| `src/components/builder/builder-inspector.tsx` | Inspector bodies for a component, a beam, and a beam being drawn |
| `src/components/builder/builder-icons.tsx` | The builder's icon set, icon button, and one glyph per part |
| `src/components/builder/builder-scene.tsx` | Orchestration: selection, drag, keyboard, files |

## Known gaps

- A beam can be drawn through a part that would not physically steer it; nothing
  validates the geometry.
- Components can overlap — there is no collision or footprint check.
- Beam colours are free-form, so the mount-colour convention is a convention,
  not something the builder enforces.
- No dimension/ruler annotations between arbitrary points yet.
