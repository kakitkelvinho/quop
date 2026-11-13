import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { duplicateComponents } from "./group-edits.ts";
import { groupSubset } from "./groups.ts";
import { mergeSetup } from "./merge-setup.ts";
import {
  EMPTY_SCENE,
  parseScene,
  serializeScene,
  settleStageMounts,
  type BuilderComponent,
  type BuilderSceneData,
} from "./types.ts";

const stage: BuilderComponent = { id: "stage", type: "translation-stage", position: [100, 0, 50], rotation: 0 };
const lens: BuilderComponent = { id: "lens", type: "lens", position: [100, 100, 50], rotation: 90, mountStage: "stage" };
const scene: BuilderSceneData = { ...EMPTY_SCENE, components: [stage, lens] };

describe("fixed translation stage", () => {
  it("places a newly mounted optic on the stage without changing its height or yaw", () => {
    const next = { ...scene, components: [stage, { ...lens, position: [300, 100, 75] as [number, number, number] }] };
    const settled = settleStageMounts(null, next);
    assert.deepEqual(settled.components[1].position, [100, 100, 50]);
    assert.equal(settled.components[1].rotation, 90);
  });

  it("carries the optic when the stage moves or turns, and lets the optic keep its own yaw edits", () => {
    const moved = settleStageMounts(scene, {
      ...scene,
      components: [{ ...stage, position: [125, 0, 75], rotation: 15 }, lens],
    });
    assert.deepEqual(moved.components[1].position, [125, 100, 75]);
    assert.equal(moved.components[1].rotation, 105);
    const opticTurned = settleStageMounts(moved, {
      ...moved,
      components: [moved.components[0], { ...moved.components[1], rotation: 120 }],
    });
    assert.equal(opticTurned.components[1].rotation, 120);
  });

  it("moves the stage when its mounted optic is dragged", () => {
    const next = settleStageMounts(scene, {
      ...scene,
      components: [stage, { ...lens, position: [150, 100, 25] }],
    });
    assert.deepEqual(next.components[0].position, [150, 0, 25]);
    assert.deepEqual(next.components[1].position, [150, 100, 25]);
  });

  it("saves the attachment and releases it if the stage is deleted", () => {
    const opened = parseScene(JSON.parse(serializeScene(scene)));
    assert.equal(opened?.components[1].mountStage, "stage");
    assert.deepEqual(opened?.components[1].position, lens.position);
    const detached = settleStageMounts(scene, { ...scene, components: [lens] });
    assert.equal(detached.components[0].mountStage, undefined);
    assert.deepEqual(detached.components[0].position, lens.position);
  });

  it("rewires an attachment only when both stage and optic are copied", () => {
    let id = 0;
    const makeId = { component: () => `copy-${++id}`, beam: () => "beam", connection: () => "connection" };
    const pair = duplicateComponents(scene, ["stage", "lens"], makeId).scene.components.slice(2);
    assert.equal(pair[1].mountStage, pair[0].id);
    const opticOnly = duplicateComponents(scene, ["lens"], makeId).scene.components.at(-1);
    assert.equal(opticOnly?.mountStage, undefined);
  });

  it("cannot become a stop on a saved beam", () => {
    const opened = parseScene({
      ...scene,
      beams: [{ id: "beam", path: ["lens", "stage", "other"], color: "#ff0000" }],
      components: [...scene.components, { id: "other", type: "lens", position: [200, 100, 50], rotation: 0 }],
    });
    assert.deepEqual(opened?.beams[0]?.path, ["lens", "other"]);
  });

  it("exports a mounted optic loose when its stage is outside the group", () => {
    const grouped = { ...scene, groups: [{ id: "g", name: "Optic", color: "#ffffff", members: ["lens"] }] };
    const subset = groupSubset(grouped, "g");
    assert.equal(subset?.scene.components[0].mountStage, undefined);
    assert.deepEqual(subset?.loosened, [{ id: "lens", from: "stage" }]);
  });

  it("rewrites the mount id when an imported stage needs a new id", () => {
    const table = { ...EMPTY_SCENE, components: [{ ...stage, position: [400, 0, 0] as [number, number, number] }] };
    const result = mergeSetup(table, scene, {
      fileName: "mounted.json",
      ids: { component: (part) => `${part.id}-new` },
    });
    assert.ok(result.ok);
    assert.equal(result.scene.components.find((part) => part.id === "lens")?.mountStage, "stage-new");
  });
});
