import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { deleteComponents, duplicateComponents, type IdMaker } from "./group-edits.ts";
import {
  createGroup,
  deleteGroup,
  groupSubset,
  isBeamDrawn,
  leftOutNotice,
  isConnectionDrawn,
  isFrameDrawn,
  nextGroupName,
  pruneMembers,
  renameGroup,
  setGroupColor,
  setGroupHidden,
  setMembership,
  visibility,
} from "./groups.ts";
import { checkSceneText, SCENE_LIMITS } from "./scene-text.ts";
import {
  GROUP_LIMIT,
  SCENE_VERSION,
  beamLengthMm,
  parseScene,
  serializeScene,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Connection,
  type Frame,
  type Group,
} from "./types.ts";

// #213: groups in the setup file. A group is a named set of parts and frames
// that hide together; a part shared by two groups stays drawn while either is
// shown, and hiding never changes geometry.

const part = (id: string, type: ComponentType, x: number, z: number): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation: 0,
});

const beam = (id: string, path: string[], extra: Partial<Beam> = {}): Beam => ({ id, path, color: "#e33", ...extra });

const fiber = (id: string, from: string, to: string): Connection => ({ id, kind: "fiber", from, to, color: "#eab308" });

const frame = (id: string, extra: Partial<Frame> = {}): Frame => ({
  id,
  corners: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  color: "#0891b2",
  ...extra,
});

const group = (id: string, members: string[], extra: Partial<Group> = {}): Group => ({
  id,
  name: id,
  color: "#7c3aed",
  members,
  ...extra,
});

/** Two experiments sharing mirror m: a → m → b, and c → m → d; f is in neither. */
function table(groups: Group[] = [], frames: Frame[] = []): BuilderSceneData {
  return {
    version: SCENE_VERSION,
    components: [
      part("a", "laser-source", -300, 0),
      part("m", "mirror-mount", 0, 0),
      part("b", "photodiode", 0, -300),
      part("c", "laser-source", 300, 0),
      part("d", "photodiode", 0, 300),
      part("f", "lens", 600, 600),
    ],
    beams: [beam("ab", ["a", "m", "b"]), beam("cd", ["c", "m", "d"])],
    connections: [fiber("link", "b", "d")],
    frames,
    groups,
  };
}

const left = (extra: Partial<Group> = {}) => group("left", ["a", "m", "b"], extra);
const right = (extra: Partial<Group> = {}) => group("right", ["c", "m", "d"], extra);

describe("which components a hidden group hides", () => {
  it("shows a part in no group", () => {
    assert.ok(visibility(table([left({ hidden: true })])).components.has("f"));
  });

  it("keeps a shared mirror while either of its groups is shown, and hides it when both are", () => {
    assert.ok(visibility(table([left({ hidden: true }), right()])).components.has("m"));
    assert.ok(visibility(table([left(), right({ hidden: true })])).components.has("m"));
    const both = visibility(table([left({ hidden: true }), right({ hidden: true })]));
    assert.ok(!both.components.has("m"));
    assert.ok(!both.components.has("a"));
  });

  it("hides the members of a hidden group that no shown group holds", () => {
    const shown = visibility(table([left({ hidden: true }), right()]));
    assert.deepEqual([...shown.components].sort(), ["c", "d", "f", "m"]);
  });
});

describe("which beams, connections and frames are drawn", () => {
  it("draws a beam, whole, while any of its stops is shown", () => {
    const scene = table([group("ends", ["a", "b"], { hidden: true })]);
    // a and b hidden, m still shown: ab is drawn
    assert.ok(isBeamDrawn(scene.beams[0], visibility(scene)));
    const all = table([group("ends", ["a", "m", "b"], { hidden: true })]);
    assert.ok(!isBeamDrawn(all.beams[0], visibility(all)));
  });

  it("leaves out a hidden beam whatever its stops", () => {
    const scene = { ...table(), beams: [beam("ab", ["a", "m", "b"], { hidden: true })] };
    assert.ok(!isBeamDrawn(scene.beams[0], visibility(scene)));
  });

  it("draws a connection while either end is shown", () => {
    const oneEnd = table([left({ hidden: true })]);
    assert.ok(isConnectionDrawn(oneEnd.connections[0], visibility(oneEnd)));
    const neither = table([left({ hidden: true }), group("d-only", ["d"], { hidden: true })]);
    assert.ok(!isConnectionDrawn(neither.connections[0], visibility(neither)));
  });

  it("draws a frame that isn't hidden while it is in no group, or in a shown one", () => {
    const frames = [frame("free"), frame("held"), frame("off", { hidden: true }), frame("shared")];
    const scene = table(
      [group("gone", ["held", "shared"], { hidden: true }), group("kept", ["shared", "off"])],
      frames,
    );
    const shown = visibility(scene);
    assert.deepEqual(
      frames.filter((entry) => isFrameDrawn(entry, shown)).map(({ id }) => id),
      ["free", "shared"],
    );
  });

  it("leaves every path length as it was", () => {
    const shown = table();
    const hidden = table([left({ hidden: true }), right({ hidden: true })]);
    for (const [index, entry] of shown.beams.entries()) {
      assert.equal(beamLengthMm(hidden.components, hidden.beams[index]), beamLengthMm(shown.components, entry));
    }
  });
});

describe("editing groups", () => {
  it("creates Group n, with the lowest free n, of the parts it's given", () => {
    const named = table([group("g", [], { name: "Group 1" }), group("h", [], { name: "Group 3" })]);
    const { scene, id } = createGroup(named, ["a", "b", "nope", "a"], undefined, () => "new");
    const made = scene.groups.find((entry) => entry.id === id)!;
    assert.equal(id, "new");
    assert.equal(made.name, "Group 2");
    assert.deepEqual(made.members, ["a", "b"]);
    assert.equal(nextGroupName([]), "Group 1");
  });

  it("gives a new group an id no part, beam, connection, frame or group has", () => {
    const ids = ["m", "ab", "link", "new"];
    const { id } = createGroup(table(), ["a"], "Mine", () => ids.shift()!);
    assert.equal(id, "new");
  });

  it("takes a periscope's other mirror in with it", () => {
    const scene: BuilderSceneData = {
      ...table(),
      components: [
        { id: "p", type: "periscope", position: [0, 50, 0], rotation: 0 },
        { id: "pt", type: "periscope-top", position: [0, 150, 0], rotation: 0, periscope: "p" },
      ],
      beams: [],
      connections: [],
    };
    assert.deepEqual(createGroup(scene, ["pt"]).scene.groups[0].members.sort(), ["p", "pt"]);
  });

  it("renames, recolours, hides and shows", () => {
    let scene = table([left()]);
    scene = renameGroup(scene, "left", "  Probe  ");
    assert.equal(scene.groups[0].name, "Probe");
    assert.equal(renameGroup(scene, "left", "   "), scene, "an empty name is refused");
    scene = setGroupColor(scene, "left", "#dc2626");
    assert.equal(scene.groups[0].color, "#dc2626");
    scene = setGroupHidden(scene, "left", true);
    assert.equal(scene.groups[0].hidden, true);
    scene = setGroupHidden(scene, "left", false);
    assert.ok(!("hidden" in scene.groups[0]));
  });

  it("puts a part in a group and takes it out", () => {
    let scene = table([left()]);
    scene = setMembership(scene, "left", "f", true);
    assert.deepEqual(scene.groups[0].members, ["a", "m", "b", "f"]);
    assert.equal(setMembership(scene, "left", "f", true), scene, "already in");
    scene = setMembership(scene, "left", "m", false);
    assert.deepEqual(scene.groups[0].members, ["a", "b", "f"]);
  });

  it("deleting a group keeps its components", () => {
    const scene = deleteGroup(table([left(), right()]), "left");
    assert.deepEqual(scene.groups.map(({ id }) => id), ["right"]);
    assert.equal(scene.components.length, 6);
  });

  it("deleting a component takes it out of every group, and keeps a group it empties", () => {
    const scene = deleteComponents(table([left(), right(), group("lone", ["f"])]), ["m", "f"]);
    assert.deepEqual(
      scene.groups.map(({ id, members }) => ({ id, members })),
      [
        { id: "left", members: ["a", "b"] },
        { id: "right", members: ["c", "d"] },
        { id: "lone", members: [] },
      ],
    );
  });

  it("deleting a frame takes it out of its groups", () => {
    const scene = table([group("g", ["a", "board"])], [frame("board")]);
    const pruned = pruneMembers({ ...scene, frames: [] });
    assert.deepEqual(pruned.groups[0].members, ["a"]);
  });

  it("a duplicate joins the groups its source is in", () => {
    let n = 0;
    const ids: IdMaker = {
      component: (source) => `${source.id}-copy`,
      beam: () => `beam-${n++}`,
      connection: () => `link-${n++}`,
    };
    const { scene } = duplicateComponents(table([left(), right()]), ["m", "f"], ids);
    assert.deepEqual(scene.groups.find(({ id }) => id === "left")?.members, ["a", "m", "b", "m-copy"]);
    assert.deepEqual(scene.groups.find(({ id }) => id === "right")?.members, ["c", "m", "d", "m-copy"]);
  });
});

describe("parsing groups", () => {
  const saved = (groups: unknown) => ({ ...table(), groups });

  it("drops member ids that name no part or frame, and duplicates", () => {
    const scene = parseScene(saved([{ id: "g", name: "G", color: "#7c3aed", members: ["a", "ab", "zz", "a", 7, "m"] }]));
    assert.deepEqual(scene?.groups[0].members, ["a", "m"]);
  });

  it("keeps a group with no members", () => {
    assert.deepEqual(parseScene(saved([{ id: "g", name: "G", color: "#7c3aed", members: [] }]))?.groups[0].members, []);
  });

  it("drops a group with no id, and fills a missing name and colour", () => {
    const scene = parseScene(saved([{ name: "No id", members: ["a"] }, { id: "g", members: ["a"] }]));
    assert.deepEqual(scene?.groups, [{ id: "g", name: "Group", color: "#7c3aed", members: ["a"] }]);
  });

  it("keeps at most the group limit, and the JSON panel refuses more", () => {
    const many = Array.from({ length: GROUP_LIMIT + 5 }, (_, index) => ({ id: `g${index}`, name: "G", members: [] }));
    assert.equal(parseScene(saved(many))?.groups.length, GROUP_LIMIT);
    assert.equal(SCENE_LIMITS.groups, 100);
    const check = checkSceneText(JSON.stringify(saved(many)));
    assert.ok(!check.ok && /at most 100/.test(check.error));
  });
});

describe("a group on its own, for Export group (#215)", () => {
  const scene = (): BuilderSceneData => ({
    ...table([left({ hidden: true }), right(), group("board-only", ["board"])], [frame("board"), frame("other")]),
    groups: [
      { ...left({ hidden: true }), members: ["a", "m", "b", "board"] },
      right(),
      group("ends", ["a", "b"]),
    ],
    beams: [beam("ab", ["a", "m", "b"]), beam("cd", ["c", "m", "d"]), beam("am", ["a", "m"]), beam("cf", ["c", "f"])],
    connections: [fiber("inner", "a", "b"), fiber("link", "b", "d"), fiber("far", "c", "d")],
    labelScale: 1.5,
  });

  it("keeps the members, inner beams and connections, at the same positions and ids", () => {
    const subset = groupSubset(scene(), "left")!;
    assert.deepEqual(subset.scene.components, scene().components.filter(({ id }) => ["a", "m", "b"].includes(id)));
    assert.deepEqual(subset.scene.beams.map(({ id }) => id), ["ab", "am"]);
    assert.deepEqual(subset.scene.connections.map(({ id }) => id), ["inner"]);
    assert.deepEqual(subset.scene.frames.map(({ id }) => id), ["board"]);
  });

  it("drops a beam or connection that leaves the group, and names it and the parts outside", () => {
    const subset = groupSubset(scene(), "left")!;
    assert.deepEqual(
      subset.leftOut.map(({ kind, item, outside }) => ({ kind, id: item.id, outside })),
      [
        { kind: "beam", id: "cd", outside: ["c", "d"] },
        { kind: "connection", id: "link", outside: ["d"] },
      ],
      "cf and far never touched the group",
    );
    assert.equal(
      leftOutNotice(scene(), "left", subset.leftOut),
      "1 beam left out: 3-stop beam passes Laser and PD, which aren't in left. 1 connection left out: Fibre goes to PD, which isn't in left.",
    );
  });

  it("says nothing when nothing was left out", () => {
    assert.equal(leftOutNotice(scene(), "ends", []), null);
  });

  it("puts a shared mirror in each group's file", () => {
    assert.ok(groupSubset(scene(), "left")!.scene.components.some(({ id }) => id === "m"));
    assert.ok(groupSubset(scene(), "right")!.scene.components.some(({ id }) => id === "m"));
  });

  it("saves the group alone and shown, even when hidden on the table, with the setup's settings", () => {
    const { scene: file } = groupSubset(scene(), "left")!;
    assert.deepEqual(file.groups, [{ id: "left", name: "left", color: "#7c3aed", members: ["a", "m", "b", "board"] }]);
    assert.equal(file.labelScale, 1.5);
  });

  it("opens as it was saved, from a real setup", () => {
    const text = readFileSync(new URL("./setup-fixtures/setup-v12.json", import.meta.url), "utf8");
    const setup = parseScene(JSON.parse(text))!;
    for (const { id } of setup.groups) {
      const { scene: file } = groupSubset(setup, id)!;
      assert.deepEqual(parseScene(JSON.parse(serializeScene(file))), file, id);
    }
  });

  it("saves a particle whose host is outside the group loose, where it stands, and says so", () => {
    const hosted: BuilderSceneData = {
      ...table([group("g", ["ion"])]),
      components: [
        { id: "trap", type: "paul-trap", position: [0, 100, 0], rotation: 0 },
        { id: "ion", type: "particle", position: [0, 100, 0], rotation: 0, host: "trap" },
      ],
      beams: [],
      connections: [],
    };
    const subset = groupSubset(hosted, "g")!;
    assert.deepEqual(subset.scene.components, [{ id: "ion", type: "particle", position: [0, 100, 0], rotation: 0 }]);
    assert.deepEqual(subset.loosened, [{ id: "ion", from: "trap" }]);
    assert.match(leftOutNotice(hosted, "g", [], subset.loosened)!, /is saved without .*, which isn't in g\./);
  });

  it("is null for a group that isn't there", () => {
    assert.equal(groupSubset(scene(), "nope"), null);
  });
});
