import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupSubset } from "./groups.ts";
import { existingGroups, isSamePart, mergeSetup, nameFromFile, type FreshIds } from "./merge-setup.ts";
import {
  EMPTY_SCENE,
  SCENE_VERSION,
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Connection,
  type Group,
} from "./types.ts";

// #216: Import into this table merges a setup file into the table, where Open
// JSON… → Apply replaces it.

const part = (id: string, type: ComponentType, x: number, z: number, extra: Partial<BuilderComponent> = {}): BuilderComponent => ({
  id,
  type,
  position: [x, 100, z],
  rotation: 0,
  ...extra,
});

const beam = (id: string, path: string[]): Beam => ({ id, path, color: "#e33" });
const fiber = (id: string, from: string, to: string): Connection => ({ id, kind: "fiber", from, to, color: "#eab308" });
const group = (id: string, name: string, members: string[], extra: Partial<Group> = {}): Group => ({
  id,
  name,
  color: "#7c3aed",
  members,
  ...extra,
});

function setup(parts: Partial<BuilderSceneData>): BuilderSceneData {
  return { version: SCENE_VERSION, components: [], beams: [], connections: [], frames: [], groups: [], ...parts };
}

/** Deterministic fresh ids: "<source id>~1", "~2", … */
function counting(): Partial<FreshIds> {
  let n = 0;
  const next = (source: { id: string }) => `${source.id}~${++n}`;
  return { component: next, beam: next, connection: next, frame: next, group: next };
}

/** Group A and Group B share mirror m: a → m → b and c → m → d. */
const twoExperiments = (): BuilderSceneData =>
  setup({
    components: [
      part("a", "laser-source", -300, 0),
      part("m", "mirror-mount", 0, 0, { rotation: 135 }),
      part("b", "photodiode", 0, -300),
      part("c", "laser-source", 300, 0),
      part("d", "photodiode", 0, 300),
    ],
    beams: [beam("ab", ["a", "m", "b"]), beam("cd", ["c", "m", "d"])],
    groups: [group("ga", "Group A", ["a", "m", "b"]), group("gb", "Group B", ["c", "m", "d"])],
  });

const exported = (scene: BuilderSceneData, id: string) => groupSubset(scene, id)!.scene;

function merged(table: BuilderSceneData, file: BuilderSceneData, fileName = "file.json", extra = {}) {
  const result = mergeSetup(table, file, { fileName, ids: counting(), ...extra });
  assert.ok(result.ok, result.ok ? "" : result.reason);
  return result;
}

describe("importing two exported groups that share a mirror", () => {
  it("brings both groups and one shared mirror, at the original positions, with beams through it", () => {
    const original = twoExperiments();
    const [fileA, fileB] = [exported(original, "ga"), exported(original, "gb")];
    const first = merged(EMPTY_SCENE, fileA, "Group A.json");
    const { scene, summary } = merged(first.scene, fileB, "Group B.json");
    assert.deepEqual(scene.components.map(({ id }) => id).sort(), ["a", "b", "c", "d", "m"]);
    for (const component of scene.components) {
      assert.deepEqual(component.position, original.components.find(({ id }) => id === component.id)?.position);
    }
    assert.deepEqual(scene.beams.map(({ path }) => path), [["a", "m", "b"], ["c", "m", "d"]]);
    assert.deepEqual(scene.groups.map(({ name, members }) => ({ name, members })), [
      { name: "Group A", members: ["a", "m", "b"] },
      { name: "Group B", members: ["c", "m", "d"] },
    ]);
    assert.equal(summary, "Imported 2 parts, 1 beam into Group B. 1 part was already on the table.");
  });
});

describe("the same part", () => {
  const table = setup({ components: [part("m1", "mirror-mount", 0, 0)] });
  const sameAs = (component: BuilderComponent) => merged(table, setup({ components: [component] })).scene.components;

  it("is one part when the id, type and place match within half a millimetre", () => {
    assert.ok(isSamePart(table.components[0], part("m1", "mirror-mount", 0.4, -0.5)));
    assert.equal(sameAs(part("m1", "mirror-mount", 0.4, -0.5)).length, 1);
  });

  it("is a second part when the id differs", () => {
    assert.deepEqual(sameAs(part("m2", "mirror-mount", 0, 0)).map(({ id }) => id), ["m1", "m2"]);
  });

  it("is a second part, with a fresh id, when the type differs", () => {
    assert.deepEqual(sameAs(part("m1", "lens", 0, 0)).map(({ id }) => id), ["m1", "m1~1"]);
  });

  it("is a second part, with a fresh id, when it stands elsewhere", () => {
    assert.deepEqual(sameAs(part("m1", "mirror-mount", 0, 0.6)).map(({ id }) => id), ["m1", "m1~1"]);
    assert.ok(!isSamePart(table.components[0], { ...part("m1", "mirror-mount", 0, 0), position: [0, 101, 0] }));
  });
});

describe("ids that clash", () => {
  it("get fresh ids, and every reference in the file follows them", () => {
    const table = setup({
      components: [part("m1", "mirror-mount", 500, 500), part("trap", "paul-trap", 900, 900)],
      beams: [beam("probe", ["m1", "trap"])],
      connections: [fiber("link", "m1", "trap")],
      frames: [{ id: "board", corners: [[0, 0], [100, 0], [100, 100], [0, 100]], color: "#0891b2" }],
      groups: [group("tg", "Table", ["m1"])],
    });
    const file = setup({
      components: [
        part("laser", "laser-source", -300, 0),
        part("m1", "mirror-mount", 0, 0),
        part("trap", "paul-trap", 0, -300),
        part("ion", "particle", 0, -300, { host: "trap" }),
      ],
      beams: [beam("probe", ["laser", "m1", "trap"])],
      connections: [fiber("link", "laser", "m1")],
      frames: [{ id: "board", corners: [[0, 0], [50, 0], [50, 50], [0, 50]], color: "#16a34a" }],
      // the group's id clashes with the table's beam
      groups: [group("probe", "Imported", ["laser", "m1", "trap", "ion", "board"])],
    });
    const { scene } = merged(table, file);
    const added = scene.components.slice(2);
    assert.deepEqual(added.map(({ id }) => id), ["laser", "m1~1", "trap~2", "ion"]);
    assert.equal(added[3].host, "trap~2");
    assert.deepEqual(scene.beams[1], { ...file.beams[0], id: "probe~4", path: ["laser", "m1~1", "trap~2"] });
    assert.deepEqual(scene.connections[1], { ...file.connections[0], id: "link~5", to: "m1~1" });
    assert.equal(scene.frames[1].id, "board~3");
    assert.deepEqual(scene.groups[1], { ...file.groups[0], id: "probe~6", members: ["laser", "m1~1", "trap~2", "ion", "board~3"] });
    // the table's own are untouched
    assert.deepEqual(scene.components.slice(0, 2), table.components);
    assert.deepEqual(scene.groups[0], table.groups[0]);
  });

  it("doesn't add a beam or connection again when it is the same, through the same parts", () => {
    const table = twoExperiments();
    const { scene, summary } = merged(table, exported(table, "ga"), "Group A.json", { onExisting: "copy" });
    assert.equal(scene.beams.length, 2);
    assert.equal(scene.components.length, 5);
    assert.equal(summary, "Imported 0 parts into Group A 2. 3 parts were already on the table.");
  });
});

describe("a file with no groups", () => {
  it("comes in as one group named after the file, and leaves the table as it was", () => {
    const table = twoExperiments();
    const file = setup({ components: [part("x", "lens", 900, 0), part("y", "iris", 1000, 0)], beams: [beam("xy", ["x", "y"])] });
    const { scene, summary } = merged(table, file, "Old bench.json");
    assert.deepEqual(scene.components.slice(0, 5), table.components);
    assert.deepEqual(scene.groups.slice(0, 2), table.groups);
    assert.equal(scene.groups[2].name, "Old bench");
    assert.deepEqual(scene.groups[2].members, ["x", "y"]);
    assert.equal(summary, "Imported 2 parts, 1 beam into Old bench.");
    assert.equal(nameFromFile("setup.JSON"), "setup");
  });

  it("keeps a file's part that is in none of its groups ungrouped", () => {
    const file = setup({ components: [part("x", "lens", 0, 0), part("y", "iris", 100, 0)], groups: [group("g", "G", ["x"])] });
    const { scene } = merged(EMPTY_SCENE, file);
    assert.deepEqual(scene.groups[0].members, ["x"]);
    assert.equal(scene.components.length, 2);
  });
});

describe("a group that is already on the table", () => {
  const table = twoExperiments();
  // Group A, edited: its photodiode moved and a lens added
  const edited = (): BuilderSceneData => {
    const file = exported(table, "ga");
    return {
      ...file,
      components: [...file.components.map((c) => (c.id === "b" ? { ...c, position: [0, 100, -400] as [number, number, number] } : c)), part("l", "lens", 0, -150)],
      beams: [beam("ab", ["a", "m", "l", "b"])],
      groups: [{ ...file.groups[0], members: [...file.groups[0].members, "l"] }],
    };
  };

  it("is found by id or by name, and must be answered", () => {
    assert.deepEqual(existingGroups(table, edited(), "Group A.json").map((pair) => pair.table.id), ["ga"]);
    const renamed = { ...edited(), groups: [{ ...edited().groups[0], id: "other" }] };
    assert.deepEqual(existingGroups(table, renamed, "x.json").map((pair) => pair.table.id), ["ga"]);
    const result = mergeSetup(table, edited(), { fileName: "Group A.json" });
    assert.ok(!result.ok && /Group A is already on the table/.test(result.reason));
  });

  it("Replace takes the table's group off, keeping a member still in another group, then brings the file's", () => {
    const { scene } = merged(table, edited(), "Group A.json", { onExisting: "replace" });
    // m stays (Group B holds it); a and b went and came back from the file
    assert.deepEqual(scene.components.map(({ id }) => id).sort(), ["a", "b", "c", "d", "l", "m"]);
    assert.deepEqual(scene.components.find(({ id }) => id === "b")?.position, [0, 100, -400]);
    assert.deepEqual(scene.beams.map(({ id, path }) => ({ id, path })), [
      { id: "cd", path: ["c", "m", "d"] },
      { id: "ab", path: ["a", "m", "l", "b"] },
    ]);
    assert.deepEqual(scene.groups.map(({ id, name }) => ({ id, name })), [
      { id: "gb", name: "Group B" },
      { id: "ga", name: "Group A" },
    ]);
    assert.ok(scene.groups[0].members.includes("m"));
  });

  it("Add as a copy brings the file's group under a new id, named <name> 2", () => {
    const { scene } = merged(table, edited(), "Group A.json", { onExisting: "copy" });
    const copy = scene.groups[2];
    assert.equal(copy.name, "Group A 2");
    assert.notEqual(copy.id, "ga");
    // the unchanged parts are the table's; the moved photodiode is a new one
    assert.deepEqual(copy.members, ["a", "m", "b~1", "l"]);
    assert.deepEqual(scene.groups.slice(0, 2), table.groups);
  });

  it("names a second copy <name> 3", () => {
    const once = merged(table, edited(), "Group A.json", { onExisting: "copy" }).scene;
    const twice = merged(once, edited(), "Group A.json", { onExisting: "copy" }).scene;
    assert.equal(twice.groups.at(-1)?.name, "Group A 3");
  });
});

describe("the setup limits", () => {
  it("refuse a merge that would go over them, and leave the table as it was", () => {
    const many = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => part(`${prefix}${index}`, "iris", index * 25, 0));
    const table = setup({ components: many("t", 300) });
    const result = mergeSetup(table, setup({ components: many("f", 250) }), { fileName: "big.json" });
    assert.ok(!result.ok);
    assert.match(result.reason, /550 parts .* at most 500/);
    assert.equal(table.components.length, 300);
  });
});
