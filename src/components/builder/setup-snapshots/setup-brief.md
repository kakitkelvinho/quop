# Writing a QUOP setup file

You are helping someone draw an optics experiment in the QUOP Tabletop, a notebook for sketching setups on an optical table. It records the layout the author intends; it does not simulate light. They will describe their experiment, and you will write a setup file (`.json`) that they open in the Tabletop's **Setup JSON** panel (**QUOP ▾ → .json**), which takes a file or pasted text.

**First, ask about anything unclear** rather than guessing: which parts, the order the light passes them, rough distances between them, where one beam splits into two, and any fibres or cables. Keep it to what changes the drawing.

**Then give them the setup as a file to download**, named after the experiment (for example `hom-interferometer.json`): if you can create files, attach it as a downloadable `.json` file. If you can't, reply with the JSON alone in one fenced ```json code block, with no other text, so they can paste it into the Tabletop's Setup JSON panel. Either way the JSON itself carries no comments (JSON has none). The Tabletop drops anything it does not recognise, so a wrong name loses that part silently.

## Conventions

- **Units.** Millimetres for every position and size; degrees for every angle; metres only for a connection's `lengthM`.
- **Axes.** The table is the x–z plane at height 0, and +y is up. In the builder's top-down view +x points right and +z points down the screen. The table has no edge, but keep x and z within ±5000.
- **Height.** A part's y is the height of its optical centre above the table. The beam height, 100 mm, is the default; give every part on one straight beam the same height unless the author says otherwise. A beam between parts at different heights slopes.
- **Ids.** Every id must be unique in the file, across components, beams, connections, frames and groups. Use short readable ones: `laser`, `m1`, `pbs`, `pd-ref`.
- **Spacing.** When the author gives no distances, 100–300 mm between neighbouring parts looks like a real bench. Multiples of 25 mm line up with the builder's grid.

## Angles

`rotation` is a yaw in degrees about the vertical axis. At 0 a part faces along +x. A positive angle turns it counter-clockwise as seen from above (in the top-down view): at 90 its +x points along −z, at 180 along −x, at 270 along +z. Use multiples of 15 where you can.

- **Beams are not traced.** A beam is drawn as straight lines between the parts in its `path`, whatever way they face. A rotation only makes the drawing look right, so to turn a beam, put a mirror at the corner in its path.
- A **laser** or **fibre collimator** emits along its own +x: rotation 0 fires toward +x, 90 toward −z, 180 toward −x, 270 toward +z.
- A part the beam passes through (a lens, waveplate, filter, iris, sample, objective, AOM, EOM, Faraday isolator or cavity) has its optical axis along its own x: rotation 0 for a beam along x, 90 for a beam along z. A **Faraday isolator** lets light through travelling along its +x, and its rejection port is on its +z side: draw light leaving that port as its own beam, starting at the isolator.
- A **delay line** stands across a beam line: its port, at its position, holds two fold mirrors on the line that send the light down the rail to a V of two mirrors on the carriage, across and back, so it leaves along the line it came in on. Put it in the middle of a straight beam, `[..., "m1", "delay", "m2", ...]` with m1, delay and m2 in a line, and the builder turns it so its rail (along its −x) is perpendicular to the beam, on the side its rotation already faces: rotation 90 puts the rail toward +z, 270 toward −z, for a beam along x. The beam is drawn through the port; `delayMinPathMm` plus twice `delayStageMm` is added to its path length.
- A **periscope** is two parts: a `periscope` (its lower mirror, on the rod) and a `periscope-top` (its upper mirror) whose `periscope` field names it. Give both the same x and z and their own heights, and put both in the beam's path, one after the other: `[..., "peri", "peri-top", ...]`. The beam runs straight up (or down) between them, and that rise counts in its path length. Each mirror is turned by the builder to face its neighbour off to the side, like a mirror in the middle of a beam. An **objective**'s tip points along +x, toward the focus. A **beam block** takes the light on its −x face, so give it the rotation of the beam's direction of travel.
- A **mirror** in the middle of a beam, and a **photodiode**, **camera**, **spectrometer** or **single-photon detector** at the end of one, are turned by the builder: the mirror to reflect the beam from the stop before it to the stop after, the detector to face the stop before it. Any rotation you write for them is replaced, so 0 will do. A mirror at either end of a path keeps the rotation you give it; its reflecting face looks along its +x.
- A **beam cube**'s reflecting diagonal runs from its −x−z corner to its +x+z corner: at rotation 0, light travelling +x carries on along +x and is reflected toward +z; at rotation 90, light travelling +x is reflected toward −z. Draw the reflected arm as its own beam, starting at the cube.

## The file

A JSON object with these keys:

- `version`: always 13. A file without it is read as the oldest version, and every height in it is reset to 100 mm.
- `components`: the parts on the table. Required.
- `beams`: the light paths, in order. The first beam through a mirror sets its angle.
- `connections`: fibres and cables between parts; `[]` when there are none.
- `frames`: outlines marking areas such as a breadboard or an enclosure; `[]` when there are none.
- `groups`: named sets of parts (and frames) that hide, select and move together, such as each experiment's parts when a table holds several; `[]` when there are none.
- `labelScale`: how large the labels on parts, connections and frames are drawn, 0.5–2 times their standard size; leave it out for the standard size, 1.

### A component

Every component has:

- `id`: text, unique in the file. Beams, connections and particles refer to the part by it.
- `type`: one of the type ids under **Component types**. A part of another type is dropped.
- `position`: `[x, y, z]`, mm. x and z place the part on the table (within ±5000): its centre, or for a part with a port (a laser's opening, a fibre collimator's lens, a detector's window, an objective's threaded plate) that port, where the beam meets it, so the distance between two parts' positions is the beam between them. y is its height, its optical centre above the table, held to the type's range.
- `rotation`: degrees, yaw about the vertical axis; default 0. See **Angles**.
- `color`: a hex colour such as `"#8b1e3f"`; missing means the part's own colour. On a `mirror-mount`, `beam-splitter`, `waveplate`, `filter`, `iris`, `fiber-collimator`, `periscope` or `periscope-top` it tints the mount, to mark the beam line the part serves.
- `label`: text drawn on the part's tag, such as `PBS`, `λ/2` or `780 nm ECDL`; missing shows the type's short name.

Some types read fields of their own; leave them out to take the default:

- `lensShape` (`lens` only): `"plano-convex"` (the default) or `"biconvex"`.
- `focalLength` (`lens` only): mm, 10–2000; default 100. It sets the drawn curvature.
- `cavityLength` (`cavity` only): mm between its two mirrors, 10–300; default 50.
- `objectiveLength` (`objective` only): mm from the back of its thread to its nose, 30–130; default 54. Only the barrel stretches.
- `opacity` (`sample` only): 0.1–1; default 0.8.
- `host` (`particle` only): the id of the `paul-trap` or `cavity` it sits in. It is then drawn at its host's centre, whatever its own position says, and moves with it.
- `periscope` (`periscope-top` only): the id of the `periscope` (its lower mirror) this top mirror belongs to. It is then drawn straight above that mirror, at its own height, whatever its own x and z say, and moves with it. Every `periscope` needs exactly one top mirror pointing at it.
- `delayMinPathMm` (`delay-line` only): mm, its minimum delay: the path a beam through it gains with its stage at 0, like a laser's `internalPathMm`. It is not drawn. 0–100000; default 50.
- `delayTravelMm` (`delay-line` only): mm, how far its stage can travel, 0–2000; default 50. Its rail is drawn long enough for it.
- `delayStageMm` (`delay-line` only): mm the stage has travelled, from 0 to `delayTravelMm`; default 0. A beam through it gains `delayMinPathMm` plus twice this, out and back, and counts both in its path length.
- `lightColor` (`cavity` and `delay-line` only): a hex colour for the light drawn inside it (a cavity's mode, a delay line's beam down to its carriage and back); default `"#ff5a36"`.
- `lightHidden` (`cavity` and `delay-line` only): `true` leaves the light inside it out of the drawing; leave it out otherwise.
- `sampleStage` (`sample` only): `"side"` draws its XYZ stage beside it, across the beam, holding it on an arm; `"none"` draws it floating. Leave it out for the default, the stage under it on a post.
- `stageColor` (`objective` and `sample` only): a hex colour for the plates of the translation stage it stands on (the micrometers stay silver). Leave it out for the theme's own: near-black by day, dark grey at night.
- `sampleStageLeft` (`sample` only): `true` puts a `"side"` stage on the sample's left (−z, looking along +x) instead of its right; leave it out otherwise.
- `particleRadius` (`particle` only): mm, 0.5–15; default 3.
- `size` (`block` only): `[along x, height, along z]`, mm, each 2–300; default `[30,30,30]`. Its height (y) is the block's centre, so one resting on the table has y = half its height.
- `internalPathMm` (`laser-source` only): mm of light path inside the laser before it leaves, such as a folded delay, 0–100000; default 0. A beam that starts at this laser counts it in its path length.

### A beam

An author-drawn path through components, recording where the light is meant to go.

- `id`: text, unique in the file.
- `path`: the component ids the light passes, source first. At least 2; a part may come back later in the path but never twice in a row. An id that names no part is dropped from the path.
- `color`: a hex colour; default `"#7c3aed"`. Give each beam its own, such as `"#7c3aed"`, `"#dc2626"`, `"#0891b2"`, `"#16a34a"`, `"#ea580c"`, `"#db2777"`.
- `label`: text shown in the beams list, such as `probe` or `reference arm`.
- `width`: drawn diameter, mm, 0.5–10; default 2.
- `opacity`: 0.1–1; default 1.
- `arrows`: `false` draws the beam as a glow with no direction arrows; leave it out otherwise.
- `hidden`: `true` leaves the beam out of the drawing; leave it out otherwise.

### A connection

A fibre or a cable from one part to another, drawn as a tube lying on the table. It is not a beam and adds nothing to any beam's path length.

- `id`: text, unique in the file.
- `kind`: `"fiber"` (optical fibre) or `"cable"` (electrical, such as coax).
- `from`: the id of the part it leaves from.
- `to`: the id of the part it goes to; never the same as `from`.
- `color`: a hex colour; default `"#eab308"` for a fibre, `"#64748b"` for a cable.
- `label`: optional text.
- `lengthM`: its length in **metres**, 0–100000; leave it out when unknown. The delay comes from this, never from the drawn route.
- `refractiveIndex`: fibre only, 1–3; default 1.468.
- `velocityFactor`: cable only, as a fraction of c, 0.1–1; default 0.66.

### A frame

A labelled outline drawn flat on the table to mark an area, such as one breadboard or an enclosure: a rectangle, or a right-angled shape such as an L or a U. Its sides run along x and z; it cannot be rotated. It constrains nothing, and parts need not be inside it.

- `id`: text, unique in the file.
- `corners`: the outline as `[x, z]` points in mm, listed around the edge in order. Every side runs along x or z; a rectangle is 4 corners. Two numbers per corner, not three: a frame lies flat at height 0. Every side at least 10 mm, and the outline at most 5000 mm across in x and in z. An outline with a slanted side, or one that crosses itself, opens as the rectangle around it.
- `color`: a hex colour; default `"#0891b2"`.
- `label`: text drawn at its back-left corner (smallest z, then smallest x), such as `Main breadboard`.
- `hidden`: `true` leaves the frame out of the drawing; leave it out otherwise.
- `fill`: `false` draws the coloured outline alone, with no tint inside; leave it out otherwise.
- `fillOpacity`: how opaque the fill is, from `0.01` to `1` (solid); leave it out for the default faint tint, `0.035`.

### A group

A named set of parts, and of frames, such as the parts of one experiment when the table holds several, so they can be hidden, selected and moved together. Groups don't nest. A part shared by two experiments, such as a mirror, is listed in both. Hiding a group leaves its members out of the drawing, but a part stays drawn while any group it is in is shown, and a beam stays drawn, whole, while any of its stops is shown. Use groups only when the author describes more than one experiment, or asks for them.

- `id`: text, unique in the file.
- `name`: text shown in the Groups box, such as `HOM interferometer`.
- `color`: a hex colour for its row and the outline round its members; such as `"#7c3aed"`.
- `hidden`: `true` takes its members out of the drawing; leave it out otherwise.
- `members`: the ids of the parts and frames in it. A part may be in several groups, such as a mirror two experiments share; never list a beam or a connection.

Older files give a frame as `position` (its centre, `[x, z]`), `width` and `depth` instead of `corners`. The builder still reads that form, but don't write it: always write `corners`.

## Component types

Each type below gives its id, what it is, and the heights it can take: a height out of range is moved to the nearest one allowed.

### Source

- `laser-source`: Laser source. Height 20–300 mm, default 100. Its own fields: `internalPathMm`.
- `fiber-collimator`: Fibre collimator. Height 20–300 mm, default 100.

### Steering

- `mirror-mount`: Mirror. Height 27–300 mm, default 100.
- `beam-splitter`: Beam cube. Height 25–300 mm, default 100.
- `periscope`: Periscope. Height 30–300 mm, default 100.
- `periscope-top`: Periscope top mirror. Height 30–300 mm, default 100. Its own fields: `periscope`.
- `delay-line`: Delay line. Height 30–300 mm, default 100. Its own fields: `delayMinPathMm`, `delayTravelMm`, `delayStageMm`, `lightColor`, `lightHidden`.

### Shaping

- `lens`: Lens. Height 17–300 mm, default 100. Its own fields: `lensShape`, `focalLength`.
- `objective`: Objective. Height 24–300 mm, default 100. Its own fields: `objectiveLength`, `stageColor`.
- `waveplate`: Waveplate. Height 36–300 mm, default 100.
- `filter`: Filter. Height 25–300 mm, default 100.
- `iris`: Iris. Height 27–300 mm, default 100.

### Modulation

- `aom`: AOM. Height 24–300 mm, default 100.
- `eom`: EOM. Height 24–300 mm, default 100.
- `faraday-isolator`: Faraday isolator. Height 26–300 mm, default 100.

### Target

- `sample`: Sample. Height 13–300 mm, default 100. Its own fields: `opacity`, `sampleStage`, `stageColor`, `sampleStageLeft`.
- `paul-trap`: Paul trap. Height 28–300 mm, default 100.
- `cavity`: Cavity. Height 16–300 mm, default 100. Its own fields: `cavityLength`, `lightColor`, `lightHidden`.
- `particle`: Particle. Height 5–300 mm, default 100. Its own fields: `host`, `particleRadius`.

### Detection

- `photodiode`: Photodiode. Height 20–300 mm, default 100.
- `camera`: Camera. Height 31–300 mm, default 100.
- `spectrometer`: Spectrometer. Height 50–300 mm, default 100.
- `single-photon-detector`: Single-photon detector. Height 23–300 mm, default 100.
- `time-tagger`: Time tagger. Height fixed at 27 mm.
- `beam-block`: Beam block. Height 21–300 mm, default 100.

### Other

- `block`: Block. Height 15–300 mm, default 100. Its own fields: `size`.

## Example

A laser fires along +x into a mirror, which turns the beam toward −z, through a lens and onto a photodiode, all at the beam height on one L-shaped breadboard, kept as one group:

```json
{
  "version": 13,
  "components": [
    { "id": "laser", "type": "laser-source", "position": [-300, 100, 0], "rotation": 0, "label": "780 nm" },
    { "id": "m1", "type": "mirror-mount", "position": [0, 100, 0], "rotation": 135, "color": "#8b1e3f", "label": "M1" },
    { "id": "lens", "type": "lens", "position": [0, 100, -150], "rotation": 90, "lensShape": "plano-convex", "focalLength": 100 },
    { "id": "pd", "type": "photodiode", "position": [0, 100, -300], "rotation": 90, "label": "PD" }
  ],
  "beams": [
    { "id": "probe", "path": ["laser", "m1", "lens", "pd"], "color": "#dc2626", "label": "probe" }
  ],
  "connections": [],
  "frames": [
    { "id": "board", "corners": [[-75, -375], [75, -375], [75, 75], [-375, 75], [-375, -75], [-75, -75]], "color": "#0891b2", "label": "Breadboard" }
  ],
  "groups": [
    { "id": "probe-arm", "name": "Probe arm", "color": "#dc2626", "members": ["laser", "m1", "lens", "pd", "board"] }
  ]
}
```
