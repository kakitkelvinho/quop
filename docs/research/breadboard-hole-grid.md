# Breadboard hole grid on the Tabletop

Findings note, 2026-10-14. Input for planning a feature; not a plan itself.

## What we want

A real optical table drawn under the parts, with its hole pattern visible, so a
layout in the Tabletop can be read against the actual bench. Beamlines in the
lab are aligned to the holes anyway, so the grid is the shared reference
between the drawing and the bench.

Components stay **independent of the holes** — no snapping to them beyond what
the builder already does. The grid is a visual guide.

## The lab's tables (MQO, Aalto)

Measured, not catalogue. The internal labels `T-SP1054` / `T-SP1056` are the
lab's own tags — they match nothing in Thorlabs' catalogue, and the lengths are
not standard Nexus sizes (2400 / 2500 mm), so these are older, custom or
another brand. Nameplate on the side skin would settle it; not needed for this
feature.

| tag        | measured      | grid positions |
| ---------- | ------------- | -------------- |
| T-SP1054   | 1500 × 2375mm | 60 × 95        |
| T-SP1056   | 1500 × 2350mm | 60 × 94        |

Tables are joined by metal plates **50 mm** wide. Layout in the room is an
inverse shoehorn seen from the door: T-SP1056 vertical, T-SP1054 horizontal.

Both lengths and the width are exact multiples of 25 mm, which is a good sign
the measurements are the true plate dimensions and the pitch is the standard
metric M6-on-25 mm.

### Boards are user-sized; the joined pair is just one case

The feature is a board of **any** `columns × rows`, placed by the user. Plenty
of setups are one small breadboard and nothing more, so nothing here should
assume a big table, and the lab's own geometry should not be baked in as a
default.

This lab's current configuration is one such case, useful as a worked example:
two T-SP1054 joined on the short (1500 mm) edge.

```
2375 + 50 + 2375 = 4800 mm   -  95 + 2 + 95 = 192 columns of pitch
width 1500 mm                -  60 rows
```

**Confirmed: the 50 mm joiner plate carries no holes.** It is a flat metallic
band. The 50 mm happens to be exactly two grid pitches, so the pitch continues
unbroken across the seam and a beamline crossing it takes no half-pitch jog —
but there is nothing to bolt to for those two columns, which is precisely the
constraint the lab is planning around.

The cleanest model is probably **two abutting boards with a 50 mm gap**, not
one board with a hole-exclusion band — the gap falls out of placement for free
and needs no new concept. Worth confirming against whatever the planning
actually needs to express.

## Where this lands in the code

- `GRID_SIZE_MM = 25` in `types.ts` already matches the real pitch, so the
  existing `snapToGrid` lines up with the holes for free. No new coordinate
  system.
- `BEAM_HEIGHT_MM = 100`, table plane is XZ at y = 0, +y up.
- `TABLE_GUARD_MM = 5000` bounds the table; a 4800 mm board fits, but only just
  if it is centred — check before assuming.
- There is currently **no table drawn**. `TableSurface` in `builder-canvas.tsx`
  is an invisible click/shadow catcher, and the only sign of a breadboard is
  drei's `<Grid infiniteGrid followCamera />`, toggled by `showGrid` in
  `builder-scene.tsx`, coloured from `palette.gridCell` / `gridSection`.
- `Frame` (`types.ts`) is already "a labelled outline marking an area, such as
  one breadboard or an enclosure" — rectangles and right-angled L/U shapes,
  sides along x and z, with its own editing, clamping and JSON plumbing, and
  documented for the LLM setup-writer in `setup-brief.ts`.

### Structural question: frame or new object?

Extending `Frame` with something like `holes?: true` reuses all of the above,
handles the L-shaped case, and lets two breadboards coexist (common in real
labs — and literally the case in this room). A single global table sized
`holesX × holesY` is simpler but makes the second board a special case.

Leaning frame. Costs: `SCENE_VERSION` bump + the compatibility rule in
`docs/adr/0001-setup-files-stay-compatible.md`, and `setup-brief.ts` needs the
new field described.

Two abutting frames give the unholed joiner band for free, with no
hole-exclusion concept to invent.

## Drawing the holes

| approach                      | cost                                    | looks                                   |
| ----------------------------- | --------------------------------------- | --------------------------------------- |
| InstancedMesh ring/cylinder   | one instance per hole; 5.7k for a 60x95 | true depth, holes occlude at grazing    |
| Tiled texture on the slab     | ~free: one 25 mm cell, repeat + aniso   | flat, indistinguishable from above      |
| `onBeforeCompile` procedural  | free, crisp at any zoom                 | flat, no texture authoring, some GLSL   |

Recommendation: **tiled texture**. The Tabletop is a notebook-style miniature
viewed mostly from above; depth buys little. `wrapS/wrapT = RepeatWrapping`,
`repeat = [columns, rows]`, anisotropy up. Swap in instancing later if hero
shots want it. The shader route trades three.js structure for GLSL debugging.

Hole marks: M6 clearance is ~6 mm, so ~0.24 of the 25 mm cell. At that size a
soft dark dot reads better than a hard-edged circle.

## Metallic finish

Real tables are brushed ferromagnetic stainless — mid-grey, fairly diffuse,
with an anisotropic sheen.

**The trap:** `metalness: 1` with no environment map renders near-black. A pure
metal has no diffuse term and there is nothing in the scene to reflect.

- *Honest metal* — add a cheap env map (drei `<Environment preset="warehouse" />`
  or a self-generated 2-colour gradient), then `color #8d9296, metalness 0.9,
  roughness 0.5`. Right look; costs an env texture and tuning against the
  existing `backdrop` palette and the day/night themes in `scene-theme.ts`.
- *Faked metal* — `color #9aa0a4, metalness 0.3, roughness 0.45`. No env map,
  reads as brushed steel at builder viewing angles, won't fight the themes.

Start faked; reach for the env map only if it looks dead. Values are starting
points to tune by eye, not settled.

## Loose ends

- Two overlapping grids will look muddy. Once a real board exists, the
  `infiniteGrid` needs rethinking — suppressed over the board, or retired, or
  demoted to an off-board reference.
- `TableSurface` is currently the click target. If a solid board sits on the
  same plane, work out which one takes pointer events before the mesh goes in.
- Shadows: stage 2.1 contact shadows are still not rendering (see `SHADING.md`).
  A real board changes what they land on; don't tune one against a broken other.
