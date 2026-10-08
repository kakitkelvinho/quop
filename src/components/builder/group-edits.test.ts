import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deleteComponents,
  duplicateComponents,
  nudgeComponents,
  rotateComponents,
  setComponentsHeight,
  setMountColor,
  translateComponents,
  type IdMaker,
} from "./group-edits.ts";
import {
  type Beam,
  type BuilderComponent,
  type BuilderSceneData,
  type ComponentType,
  type Vec3,
  SCENE_VERSION,
  settleAngles,
  settleHosts,
} from "./types.ts";

// #103: several parts selected and edited as one rigid group.

const part = (
  id: string,
  type: ComponentType,
  x: number,
  z: number,
  extra: Partial<BuilderComponent> = {},
): BuilderComponent => ({ id, type, position: [x, 100, z], rotation: 0, ...extra });

const beam = (id: string, path: string[]): Beam => ({ id, path, color: "#e33" });

function bench(components: BuilderComponent[], beams: Beam[] = []): BuilderSceneData {
  return { version: SCENE_VERSION, components, beams };
}

const at = (scene: BuilderSceneData, id: string) =>
  scene.components.find((component) => component.id === id);

const where = (scene: BuilderSceneData, id: string) => at(scene, id)?.position;

describe("dragging a group", () => {
  const scene = bench([
    part("a", "mirror-mount", 0, 0),
    part("b", "lens", 100, 50),
    part("c", "iris", 300, 0),
  ]);
  const origins: Record<string, Vec3> = { a: [0, 100, 0], b: [100, 100, 50] };

  it("moves each part by the same step from where it started", () => {
    const moved = translateComponents(scene, origins, 25, -50);
    assert.deepEqual(where(moved, "a"), [25, 100, -50]);
    assert.deepEqual(where(moved, "b"), [125, 100, 0]);
  });

  it("leaves the parts outside the group where they are", () => {
    const moved = translateComponents(scene, origins, 25, -50);
    assert.equal(at(moved, "c"), at(scene, "c"));
  });

  it("measures each step from the origins, so the group never drifts", () => {
    const first = translateComponents(scene, origins, 25, 0);
    const second = translateComponents(first, origins, 50, 0);
    assert.deepEqual(where(second, "a"), [50, 100, 0]);
    assert.deepEqual(where(second, "b"), [150, 100, 50]);
  });

  it("stops each part at the table's guard", () => {
    const edge = bench([part("a", "mirror-mount", 4990, 0)]);
    assert.deepEqual(where(translateComponents(edge, { a: [4990, 100, 0] }, 25, 0), "a"), [5000, 100, 0]);
  });

  it("is no edit when nothing moves", () => {
    assert.equal(translateComponents(scene, origins, 0, 0), scene);
  });
});

describe("a particle in a group", () => {
  const trap = part("trap", "paul-trap", 0, 0);
  const particle = part("p", "particle", 0, 0, { host: "trap" });

  it("rides with its host when the host is in the group too", () => {
    const scene = bench([trap, particle]);
    const moved = translateComponents(scene, { trap: [0, 100, 0], p: [0, 100, 0] }, 50, 25);
    assert.deepEqual(where(moved, "p"), [0, 100, 0], "the particle isn't moved on its own");
    const settled = settleHosts(moved);
    assert.deepEqual(where(settled, "p"), [50, 100, 25]);
    assert.equal(at(settled, "p")?.host, "trap");
  });

  it("lets go of a host left out of the group", () => {
    const scene = bench([trap, particle, part("m", "mirror-mount", 100, 0)]);
    const nudged = settleHosts(nudgeComponents(scene, ["p", "m"], 25, 0));
    assert.deepEqual(at(nudged, "p"), { id: "p", type: "particle", position: [25, 100, 0], rotation: 0 });
  });
});

describe("nudging a group", () => {
  const scene = bench([part("a", "mirror-mount", 0, 0), part("b", "lens", 100, 50), part("c", "iris", 300, 0)]);

  it("moves every selected part one step", () => {
    const nudged = nudgeComponents(scene, ["a", "b"], 0, -5);
    assert.deepEqual(where(nudged, "a"), [0, 100, -5]);
    assert.deepEqual(where(nudged, "b"), [100, 100, 45]);
    assert.deepEqual(where(nudged, "c"), [300, 100, 0]);
  });

  it("is no edit when every part is already at the guard", () => {
    const edge = bench([part("a", "mirror-mount", 5000, 0)]);
    assert.equal(nudgeComponents(edge, ["a"], 25, 0), edge);
  });
});

describe("turning a group", () => {
  const pair = bench([part("a", "laser-source", 0, 0), part("b", "mirror-mount", 100, 0)]);

  it("turns the parts 15° about their centre, and each part with them", () => {
    const turned = rotateComponents(pair, ["a", "b"], 1);
    assert.deepEqual(at(turned, "a"), { id: "a", type: "laser-source", position: [1.7, 100, 12.94], rotation: 15 });
    assert.deepEqual(at(turned, "b"), { id: "b", type: "mirror-mount", position: [98.3, 100, -12.94], rotation: 15 });
  });

  it("comes back exactly when turned back", () => {
    const back = rotateComponents(rotateComponents(pair, ["a", "b"], 1), ["a", "b"], -1);
    assert.deepEqual(where(back, "a"), [0, 100, 0]);
    assert.deepEqual(where(back, "b"), [100, 100, 0]);
    assert.equal(at(back, "a")?.rotation, 0);
  });

  it("wraps the yaw into 0–360", () => {
    const scene = bench([part("a", "lens", 0, 0, { rotation: 350 }), part("b", "lens", 0, 100)]);
    assert.equal(at(rotateComponents(scene, ["a", "b"], 1), "a")?.rotation, 5);
    assert.equal(at(rotateComponents(scene, ["a", "b"], -1), "b")?.rotation, 345);
  });

  it("turns one part in place, its position exactly as it was", () => {
    const scene = bench([part("a", "lens", 12.345, -0.001)]);
    assert.deepEqual(at(rotateComponents(scene, ["a"], 1), "a"), {
      id: "a",
      type: "lens",
      position: [12.345, 100, -0.001],
      rotation: 15,
    });
  });

  it("finds the centre from the parts that move themselves, not a particle riding a host", () => {
    const scene = bench([
      part("trap", "paul-trap", 0, 0),
      part("p", "particle", 0, 0, { host: "trap" }),
      part("m", "mirror-mount", 100, 0),
    ]);
    // the centre is (50, 0), as for the trap and mirror alone
    const turned = settleHosts(rotateComponents(scene, ["trap", "p", "m"], 1));
    assert.deepEqual(where(turned, "trap"), [1.7, 100, 12.94]);
    assert.deepEqual(where(turned, "m"), [98.3, 100, -12.94]);
    assert.deepEqual(where(turned, "p"), [1.7, 100, 12.94]);
  });

  it("re-angles a mirror in the middle of a beam with the turn", () => {
    const scene = settleAngles(
      bench(
        [part("laser", "laser-source", -100, 0), part("m", "mirror-mount", 0, 0), part("pd", "photodiode", 0, -100)],
        [beam("b", ["laser", "m", "pd"])],
      ),
    );
    assert.equal(at(scene, "m")?.rotation, 135);
    const turned = settleAngles(rotateComponents(scene, ["laser", "m", "pd"], 1));
    assert.equal(at(turned, "m")?.rotation, 150);
    assert.equal(at(turned, "laser")?.rotation, 15);
  });
});

describe("deleting a group", () => {
  const scene = bench(
    [part("a", "laser-source", 0, 0), part("b", "mirror-mount", 100, 0), part("c", "photodiode", 100, 100)],
    [beam("ab", ["a", "b"]), beam("abc", ["a", "b", "c"])],
  );

  it("takes the parts off the table and off every beam", () => {
    const after = deleteComponents(scene, ["a", "c"]);
    assert.deepEqual(after.components.map(({ id }) => id), ["b"]);
    assert.deepEqual(after.beams, []);
  });

  it("keeps a beam that still has 2 stops", () => {
    const after = deleteComponents(scene, ["a"]);
    assert.deepEqual(after.beams, [beam("abc", ["b", "c"])]);
  });

  it("is no edit when none of the parts is there", () => {
    assert.equal(deleteComponents(scene, ["gone"]), scene);
  });
});

describe("duplicating a group", () => {
  const labelled: IdMaker = {
    component: (source) => `${source.id}-copy`,
    beam: (source) => `${source.id}-copy`,
  };
  const scene = bench(
    [
      part("a", "laser-source", 0, 0),
      part("b", "mirror-mount", 100, 0, { color: "#dc2626", rotation: 45 }),
      part("c", "photodiode", 100, 100),
    ],
    [beam("ab", ["a", "b"]), beam("abc", ["a", "b", "c"])],
  );

  it("copies each part one grid step along x and z, and returns the copies' ids in order", () => {
    const { scene: after, ids } = duplicateComponents(scene, ["b", "a"], labelled);
    assert.deepEqual(ids, ["b-copy", "a-copy"]);
    assert.deepEqual(at(after, "b-copy"), {
      id: "b-copy",
      type: "mirror-mount",
      position: [125, 100, 25],
      rotation: 45,
      color: "#dc2626",
    });
    assert.deepEqual(where(after, "a-copy"), [25, 100, 25]);
    assert.equal(after.components.length, 5);
  });

  it("copies only the beams that run between copied parts", () => {
    const { scene: after } = duplicateComponents(scene, ["a", "b"], labelled);
    assert.deepEqual(after.beams, [
      beam("ab", ["a", "b"]),
      beam("abc", ["a", "b", "c"]),
      beam("ab-copy", ["a-copy", "b-copy"]),
    ]);
  });

  it("puts a copied particle in its host's copy, and a particle copied alone in none", () => {
    const hosted = bench([part("trap", "paul-trap", 0, 0), part("p", "particle", 0, 0, { host: "trap" })]);
    assert.equal(at(duplicateComponents(hosted, ["trap", "p"], labelled).scene, "p-copy")?.host, "trap-copy");
    const alone = at(duplicateComponents(hosted, ["p"], labelled).scene, "p-copy");
    assert.deepEqual(alone, { id: "p-copy", type: "particle", position: [25, 100, 25], rotation: 0 });
  });

  it("makes new ids of its own by default", () => {
    const { scene: after, ids } = duplicateComponents(scene, ["a", "b"]);
    assert.equal(new Set([...ids, "a", "b", "c"]).size, 5);
    const copy = after.beams[2];
    assert.notEqual(copy.id, "ab");
    assert.deepEqual(copy.path, ids);
  });

  it("is no edit for parts that aren't there", () => {
    assert.deepEqual(duplicateComponents(scene, ["gone"]), { scene, ids: [] });
  });
});

describe("setting a group's height", () => {
  it("keeps each part to its own range", () => {
    const scene = bench([part("m", "mirror-mount", 0, 0), part("s", "spectrometer", 100, 0), part("l", "lens", 0, 100)]);
    const after = setComponentsHeight(scene, ["m", "s", "l"], 20);
    assert.deepEqual(where(after, "m"), [0, 27, 0]);
    assert.deepEqual(where(after, "s"), [100, 100, 0]);
    assert.deepEqual(where(after, "l"), [0, 20, 100]);
  });
});

describe("setting a group's mount colour", () => {
  it("tints only the parts held in a mount", () => {
    const scene = bench([part("m", "mirror-mount", 0, 0), part("l", "lens", 100, 0), part("w", "waveplate", 0, 100)]);
    const after = setMountColor(scene, ["m", "l", "w"], "#16a34a");
    assert.equal(at(after, "m")?.color, "#16a34a");
    assert.equal(at(after, "w")?.color, "#16a34a");
    assert.equal(at(after, "l"), at(scene, "l"));
  });
});
