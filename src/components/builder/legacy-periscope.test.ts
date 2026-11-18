import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { settleAims } from "./aim-settling.ts";
import { measureBeam } from "./beam-measurement.ts";
import { duplicateComponents, nudgeComponents } from "./group-edits.ts";
import { traceScene } from "./trace-scene.ts";
import { parseScene, serializeScene } from "./types.ts";

function oldSetup(version: number) {
  return {
    version,
    components: [
      { id: "laser", type: "laser-source", position: [-200, 100, 0], orientation: [0, 0, 0, 1] },
      { id: "lower", type: "periscope", position: [0, 100, 0], orientation: [0, 0, 0, 1], label: "P1", color: "#16a34a" },
      { id: "upper", type: "periscope-top", position: [30, 250, 40], orientation: [0, 0, 0, 1], periscope: "lower" },
      { id: "detector", type: "photodiode", position: [0, 250, -200], orientation: [0, 0, 0, 1] },
    ],
    beams: [{ id: "path", path: ["laser", "lower", "upper", "detector"], color: "#ffffff" }],
    groups: [{ id: "elevator", name: "Elevator", members: ["lower"], color: "#ffffff" }],
    connections: [], frames: [],
  };
}

describe("legacy mirror pair migration", () => {
  for (const version of [17, 18]) {
    it(`opens version ${version} as two aimed ordinary mirrors`, () => {
      const scene = parseScene(oldSetup(version));
      assert.ok(scene);
      const lower = scene.components.find((part) => part.id === "lower");
      const upper = scene.components.find((part) => part.id === "upper");
      assert.equal(lower?.type, "mirror-mount");
      assert.equal(upper?.type, "mirror-mount");
      assert.deepEqual(lower?.position, [0, 100, 0]);
      assert.deepEqual(upper?.position, [0, 250, 0]);
      assert.equal(lower?.aim, "upper");
      assert.equal(upper?.aim, "detector");
      assert.equal(lower?.label, "P1");
      assert.equal(upper?.label, "P1 top");
      assert.equal(upper?.color, lower?.color);
      assert.deepEqual(scene.groups[0].members, ["lower", "upper"]);
      assert.deepEqual(scene.beams[0].path, ["laser", "lower", "upper", "detector"]);
      assert.equal(measureBeam(scene.components, scene.beams[0]).lengthMm, 550);
      const reopened = parseScene(JSON.parse(serializeScene(scene)));
      assert.ok(reopened);
      assert.deepEqual(reopened.components.map((part) => part.type), scene.components.map((part) => part.type));
    });
  }

  it("traces the rise between the two mirrors", () => {
    const scene = parseScene(oldSetup(17));
    assert.ok(scene);
    const traced = traceScene(settleAims(scene).scene);
    assert.ok(traced.trees[0].segments.some((segment) => segment.fromId === "lower" && segment.toId === "upper"));
  });

  it("moves either mirror independently and reconnects aims when both are copied", () => {
    const scene = parseScene(oldSetup(18));
    assert.ok(scene);
    const moved = nudgeComponents(scene, ["upper"], 25, 0);
    assert.deepEqual(moved.components.find((part) => part.id === "lower")?.position, [0, 100, 0]);
    assert.deepEqual(moved.components.find((part) => part.id === "upper")?.position, [25, 250, 0]);
    const copies = duplicateComponents(scene, ["lower", "upper"], {
      component: (part) => `${part.id}-copy`, beam: () => "copy-beam", connection: () => "copy-connection",
    }).scene;
    assert.equal(copies.components.find((part) => part.id === "lower-copy")?.aim, "upper-copy");
  });
});
