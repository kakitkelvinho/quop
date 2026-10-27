// The setup brief: Markdown an author pastes into an AI assistant so it writes
// a setup file for the experiment they describe. The prose is written here;
// the component types, their heights and the defaults come from types.ts, so
// a new type shows up on its own. A new field on a component, beam,
// connection or frame won't typecheck until it has a line in the tables below,
// or, for a field only some kinds of component have, in COMPONENT_FIELDS.
// setup-brief.test.ts opens the worked example with the setup parser.

import {
  BEAM_COLORS,
  BEAM_HEIGHT_MM,
  BEAM_OPACITY_RANGE,
  BEAM_WIDTH_MM,
  BEAM_WIDTH_RANGE_MM,
  PART_CATEGORIES,
  COMPONENT_SPECS,
  CONNECTION_KINDS,
  CONNECTION_LENGTH_RANGE_M,
  DEFAULT_MOUNT_COLOR,
  FRAME_COLORS,
  FRAME_FILL_OPACITY,
  FRAME_FILL_OPACITY_RANGE,
  FRAME_SIZE_RANGE_MM,
  LABEL_SCALE_RANGE,
  MOUNTED_TYPES,
  ROTATION_STEP_DEG,
  SCENE_VERSION,
  TABLE_GUARD_MM,
  COMPONENT_FIELDS,
  briefCode as code,
  briefRange as range,
  briefTypeList as typeList,
  defaultHeight,
  kindsWhere,
  heightRange,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Connection,
  type Frame,
  type Group,
  type KindField,
} from "./types.ts";

/** One line per field. */
type FieldDocs<T> = { [K in keyof T]-?: { text: string } };

/** The kinds that have `field`, in COMPONENT_SPECS's order. */
const kindsWith = (field: KindField) => kindsWhere((spec) => spec.fields.includes(field));

const FILE_FIELDS: FieldDocs<BuilderSceneData> = {
  version: {
    text: `always ${SCENE_VERSION}. A file without it is read as the oldest version, and every height in it is reset to ${BEAM_HEIGHT_MM} mm.`,
  },
  components: { text: "the parts on the table. Required." },
  beams: { text: "the light paths, in order. The first beam through a mirror sets its angle." },
  connections: { text: "fibres and cables between parts; `[]` when there are none." },
  frames: { text: "outlines marking areas such as a breadboard or an enclosure; `[]` when there are none." },
  groups: {
    text: "named sets of parts (and frames) that hide, select and move together, such as each experiment's parts when a table holds several; `[]` when there are none.",
  },
  labelScale: {
    text: `how large the labels on parts, connections and frames are drawn, ${range(LABEL_SCALE_RANGE)} times their standard size; leave it out for the standard size, 1.`,
  },
};

/** The fields every component has; those only some kinds have are in COMPONENT_FIELDS. */
const COMMON_FIELDS: FieldDocs<Pick<BuilderComponent, "id" | "type" | "position" | "rotation" | "color" | "label">> = {
  id: { text: "text, unique in the file. Beams, connections and particles refer to the part by it." },
  type: { text: "one of the type ids under **Component types**. A part of another type is dropped." },
  position: {
    text: `\`[x, y, z]\`, mm. x and z place the part on the table (within ±${TABLE_GUARD_MM}): its centre, or for a part with a port (a laser's opening, a fibre collimator's lens, a detector's window, an objective's threaded plate) that port, where the beam meets it, so the distance between two parts' positions is the beam between them. y is its height, its optical centre above the table, held to the type's range.`,
  },
  rotation: { text: "degrees, yaw about the vertical axis; default 0. See **Angles**." },
  color: {
    text: `a hex colour such as ${code(DEFAULT_MOUNT_COLOR)}; missing means the part's own colour. On a ${typeList(MOUNTED_TYPES, "or")} it tints the mount, to mark the beam line the part serves.`,
  },
  label: { text: "text drawn on the part's tag, such as `PBS`, `λ/2` or `780 nm ECDL`; missing shows the type's short name." },
};

const BEAM_FIELDS: FieldDocs<Beam> = {
  id: { text: "text, unique in the file." },
  path: {
    text: "the component ids the light passes, source first. At least 2; a part may come back later in the path but never twice in a row. An id that names no part is dropped from the path.",
  },
  color: { text: `a hex colour; default ${code(BEAM_COLORS[0])}. Give each beam its own, such as ${BEAM_COLORS.map((color) => code(color)).join(", ")}.` },
  label: { text: "text shown in the beams list, such as `probe` or `reference arm`." },
  width: { text: `drawn diameter, mm, ${range(BEAM_WIDTH_RANGE_MM)}; default ${BEAM_WIDTH_MM}.` },
  opacity: { text: `${range(BEAM_OPACITY_RANGE)}; default 1.` },
  arrows: { text: "`false` draws the beam as a glow with no direction arrows; leave it out otherwise." },
  hidden: { text: "`true` leaves the beam out of the drawing; leave it out otherwise." },
};

const CONNECTION_FIELDS: FieldDocs<Connection> = {
  id: { text: "text, unique in the file." },
  kind: { text: `${code("fiber")} (optical fibre) or ${code("cable")} (electrical, such as coax).` },
  from: { text: "the id of the part it leaves from." },
  to: { text: "the id of the part it goes to; never the same as `from`." },
  color: {
    text: `a hex colour; default ${code(CONNECTION_KINDS.fiber.color)} for a fibre, ${code(CONNECTION_KINDS.cable.color)} for a cable.`,
  },
  label: { text: "optional text." },
  lengthM: {
    text: `its length in **metres**, ${range(CONNECTION_LENGTH_RANGE_M)}; leave it out when unknown. The delay comes from this, never from the drawn route.`,
  },
  refractiveIndex: {
    text: `fibre only, ${range(CONNECTION_KINDS.fiber.index.range)}; default ${CONNECTION_KINDS.fiber.index.fallback}.`,
  },
  velocityFactor: {
    text: `cable only, as a fraction of c, ${range(CONNECTION_KINDS.cable.index.range)}; default ${CONNECTION_KINDS.cable.index.fallback}.`,
  },
};

const FRAME_FIELDS: FieldDocs<Frame> = {
  id: { text: "text, unique in the file." },
  corners: {
    text: `the outline as \`[x, z]\` points in mm, listed around the edge in order. Every side runs along x or z; a rectangle is 4 corners. Two numbers per corner, not three: a frame lies flat at height 0. Every side at least ${FRAME_SIZE_RANGE_MM[0]} mm, and the outline at most ${FRAME_SIZE_RANGE_MM[1]} mm across in x and in z. An outline with a slanted side, or one that crosses itself, opens as the rectangle around it.`,
  },
  color: { text: `a hex colour; default ${code(FRAME_COLORS[0])}.` },
  label: { text: "text drawn at its back-left corner (smallest z, then smallest x), such as `Main breadboard`." },
  hidden: { text: "`true` leaves the frame out of the drawing; leave it out otherwise." },
  fill: { text: "`false` draws the coloured outline alone, with no tint inside; leave it out otherwise." },
  fillOpacity: {
    text: `how opaque the fill is, from ${code(FRAME_FILL_OPACITY_RANGE[0])} to ${code(1)} (solid); leave it out for the default faint tint, ${code(FRAME_FILL_OPACITY)}.`,
  },
};

const GROUP_FIELDS: FieldDocs<Group> = {
  id: { text: "text, unique in the file." },
  name: { text: "text shown in the Groups box, such as `HOM interferometer`." },
  color: { text: `a hex colour for its row and the outline round its members; such as ${code(BEAM_COLORS[0])}.` },
  hidden: { text: "`true` takes its members out of the drawing; leave it out otherwise." },
  members: {
    text: "the ids of the parts and frames in it. A part may be in several groups, such as a mirror two experiments share; never list a beam or a connection.",
  },
};

function fieldList<T>(fields: FieldDocs<T>): string {
  return (Object.entries(fields) as [string, { text: string }][]).map(([key, doc]) => `- \`${key}\`: ${doc.text}`).join("\n");
}

/** The fields only some kinds have, in the brief's order. */
const KIND_FIELDS = Object.keys(COMPONENT_FIELDS) as KindField[];

function heightLine(type: ComponentType): string {
  const [min, max] = heightRange(type);
  return min === max ? `Height fixed at ${min} mm.` : `Height ${min}–${max} mm, default ${defaultHeight(type)}.`;
}

/** One entry per type, in the parts panel's groups: what it is, its heights, and the fields only it reads. */
function componentTypes(): string {
  return PART_CATEGORIES.map(({ name, types }) => {
    const entries = types.map((type) => {
      const spec = COMPONENT_SPECS[type];
      const own = KIND_FIELDS.filter((field) => spec.fields.includes(field)).map((field) => `\`${field}\``);
      const fields = own.length ? ` Its own fields: ${own.join(", ")}.` : "";
      return `- \`${type}\`: ${spec.label}. ${heightLine(type)}${fields}`;
    });
    return `### ${name}\n\n${entries.join("\n")}`;
  }).join("\n\n");
}

/**
 * The worked example, written as the builder would save it: the mirror and
 * the photodiode already carry the angles their beam gives them.
 */
export const EXAMPLE_SETUP: BuilderSceneData = {
  version: SCENE_VERSION,
  components: [
    { id: "laser", type: "laser-source", position: [-300, 100, 0], rotation: 0, label: "780 nm" },
    { id: "m1", type: "mirror-mount", position: [0, 100, 0], rotation: 135, color: DEFAULT_MOUNT_COLOR, label: "M1" },
    { id: "lens", type: "lens", position: [0, 100, -150], rotation: 90, lensShape: "plano-convex", focalLength: 100 },
    { id: "pd", type: "photodiode", position: [0, 100, -300], rotation: 90, label: "PD" },
  ],
  beams: [{ id: "probe", path: ["laser", "m1", "lens", "pd"], color: "#dc2626", label: "probe" }],
  connections: [],
  // an L: one arm along the laser's line, one along the turned beam
  frames: [
    {
      id: "board",
      corners: [
        [-75, -375],
        [75, -375],
        [75, 75],
        [-375, 75],
        [-375, -75],
        [-75, -75],
      ],
      color: "#0891b2",
      label: "Breadboard",
    },
  ],
  groups: [{ id: "probe-arm", name: "Probe arm", color: "#dc2626", members: ["laser", "m1", "lens", "pd", "board"] }],
};

/** JSON on one line, spaced as the setup fixtures are: `{ "id": "m1", "position": [0, 100, 0] }`. */
function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    return `{ ${entries.map(([key, entry]) => `${JSON.stringify(key)}: ${inlineJson(entry)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
}

/** The example with one line per component, beam and frame. */
function exampleJson(): string {
  const lists = (["components", "beams", "connections", "frames", "groups"] as const).map((key) => {
    const items = EXAMPLE_SETUP[key];
    if (!items.length) return `  "${key}": []`;
    return `  "${key}": [\n${items.map((item) => `    ${inlineJson(item)}`).join(",\n")}\n  ]`;
  });
  return `{\n  "version": ${EXAMPLE_SETUP.version},\n${lists.join(",\n")}\n}`;
}

export const SETUP_BRIEF_FILENAME = "quop-setup-brief.md";

/** The brief, as Markdown. */
export function setupBrief(): string {
  return `# Writing a QUOP setup file

You are helping someone draw an optics experiment in the QUOP Tabletop, a notebook for sketching setups on an optical table. It records the layout the author intends; it does not simulate light. They will describe their experiment, and you will write a setup file (\`.json\`) that they open in the Tabletop's **Setup JSON** panel (**QUOP ▾ → .json**), which takes a file or pasted text.

**First, ask about anything unclear** rather than guessing: which parts, the order the light passes them, rough distances between them, where one beam splits into two, and any fibres or cables. Keep it to what changes the drawing.

**Then give them the setup as a file to download**, named after the experiment (for example \`hom-interferometer.json\`): if you can create files, attach it as a downloadable \`.json\` file. If you can't, reply with the JSON alone in one fenced \`\`\`json code block, with no other text, so they can paste it into the Tabletop's Setup JSON panel. Either way the JSON itself carries no comments (JSON has none). The Tabletop drops anything it does not recognise, so a wrong name loses that part silently.

## Conventions

- **Units.** Millimetres for every position and size; degrees for every angle; metres only for a connection's \`lengthM\`.
- **Axes.** The table is the x–z plane at height 0, and +y is up. In the builder's top-down view +x points right and +z points down the screen. The table has no edge, but keep x and z within ±${TABLE_GUARD_MM}.
- **Height.** A part's y is the height of its optical centre above the table. The beam height, ${BEAM_HEIGHT_MM} mm, is the default; give every part on one straight beam the same height unless the author says otherwise. A beam between parts at different heights slopes.
- **Ids.** Every id must be unique in the file, across components, beams, connections, frames and groups. Use short readable ones: \`laser\`, \`m1\`, \`pbs\`, \`pd-ref\`.
- **Spacing.** When the author gives no distances, 100–300 mm between neighbouring parts looks like a real bench. Multiples of 25 mm line up with the builder's grid.

## Angles

\`rotation\` is a yaw in degrees about the vertical axis. At 0 a part faces along +x. A positive angle turns it counter-clockwise as seen from above (in the top-down view): at 90 its +x points along −z, at 180 along −x, at 270 along +z. Use multiples of ${ROTATION_STEP_DEG} where you can.

- **Beams are not traced.** A beam is drawn as straight lines between the parts in its \`path\`, whatever way they face. A rotation only makes the drawing look right, so to turn a beam, put a mirror at the corner in its path.
- A **laser** or **fibre collimator** emits along its own +x: rotation 0 fires toward +x, 90 toward −z, 180 toward −x, 270 toward +z.
- A part the beam passes through (a lens, waveplate, filter, iris, sample, objective, AOM, EOM, Faraday isolator or cavity) has its optical axis along its own x: rotation 0 for a beam along x, 90 for a beam along z. A **Faraday isolator** lets light through travelling along its +x, and its rejection port is on its +z side: draw light leaving that port as its own beam, starting at the isolator.
- A **delay line** stands across a beam line: its port, at its position, holds two fold mirrors on the line that send the light down the rail to a V of two mirrors on the carriage, across and back, so it leaves along the line it came in on. Put it in the middle of a straight beam, \`[..., "m1", "delay", "m2", ...]\` with m1, delay and m2 in a line, and the builder turns it so its rail (along its −x) is perpendicular to the beam, on the side its rotation already faces: rotation 90 puts the rail toward +z, 270 toward −z, for a beam along x. The beam is drawn through the port; \`delayMinPathMm\` plus twice \`delayStageMm\` is added to its path length.
- A **periscope** is two parts: a \`periscope\` (its lower mirror, on the rod) and a \`periscope-top\` (its upper mirror) whose \`periscope\` field names it. Give both the same x and z and their own heights, and put both in the beam's path, one after the other: \`[..., "peri", "peri-top", ...]\`. The beam runs straight up (or down) between them, and that rise counts in its path length. Each mirror is turned by the builder to face its neighbour off to the side, like a mirror in the middle of a beam. An **objective**'s tip points along +x, toward the focus. A **beam block** takes the light on its −x face, so give it the rotation of the beam's direction of travel.
- A **mirror** in the middle of a beam, and a **photodiode**, **camera**, **spectrometer** or **single-photon detector** at the end of one, are turned by the builder: the mirror to reflect the beam from the stop before it to the stop after, the detector to face the stop before it. Any rotation you write for them is replaced, so 0 will do. A mirror at either end of a path keeps the rotation you give it; its reflecting face looks along its +x.
- A **beam cube**'s reflecting diagonal runs from its −x−z corner to its +x+z corner: at rotation 0, light travelling +x carries on along +x and is reflected toward +z; at rotation 90, light travelling +x is reflected toward −z. Draw the reflected arm as its own beam, starting at the cube.

## The file

A JSON object with these keys:

${fieldList(FILE_FIELDS)}

### A component

Every component has:

${fieldList(COMMON_FIELDS)}

Some types read fields of their own; leave them out to take the default:

${KIND_FIELDS.map((field) => `- \`${field}\` (${typeList(kindsWith(field), "and")} only): ${COMPONENT_FIELDS[field].brief}`).join("\n")}

### A beam

An author-drawn path through components, recording where the light is meant to go.

${fieldList(BEAM_FIELDS)}

### A connection

A fibre or a cable from one part to another, drawn as a tube lying on the table. It is not a beam and adds nothing to any beam's path length.

${fieldList(CONNECTION_FIELDS)}

### A frame

A labelled outline drawn flat on the table to mark an area, such as one breadboard or an enclosure: a rectangle, or a right-angled shape such as an L or a U. Its sides run along x and z; it cannot be rotated. It constrains nothing, and parts need not be inside it.

${fieldList(FRAME_FIELDS)}

### A group

A named set of parts, and of frames, such as the parts of one experiment when the table holds several, so they can be hidden, selected and moved together. Groups don't nest. A part shared by two experiments, such as a mirror, is listed in both. Hiding a group leaves its members out of the drawing, but a part stays drawn while any group it is in is shown, and a beam stays drawn, whole, while any of its stops is shown. Use groups only when the author describes more than one experiment, or asks for them.

${fieldList(GROUP_FIELDS)}

Older files give a frame as \`position\` (its centre, \`[x, z]\`), \`width\` and \`depth\` instead of \`corners\`. The builder still reads that form, but don't write it: always write \`corners\`.

## Component types

Each type below gives its id, what it is, and the heights it can take: a height out of range is moved to the nearest one allowed.

${componentTypes()}

## Example

A laser fires along +x into a mirror, which turns the beam toward −z, through a lens and onto a photodiode, all at the beam height on one L-shaped breadboard, kept as one group:

\`\`\`json
${exampleJson()}
\`\`\`
`;
}
