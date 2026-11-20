import assert from "node:assert/strict";
import { it } from "node:test";

import { fromYawDeg } from "./quaternion.ts";
import { traceGuideGeometry } from "./trace-guide.ts";
import { traceScene, type TraceResult } from "./trace-scene.ts";
import { newComponent, SCENE_VERSION, type Beam, type BuilderComponent } from "./types.ts";

const trace: TraceResult = {
  trees: [{ laserId: "laser", segments: [
    { fromMm: [0, 100, 0], toMm: [200, 100, 0], fromId: "laser", toId: "mirror", path: ["laser", "mirror"], power: 1, pathLengthMm: 200, arm: "through" },
    { fromMm: [200, 100, 0], toMm: [700, 100, 0], fromId: "mirror", toId: null, path: ["laser", "mirror"], power: 1, pathLengthMm: 700, arm: "reflected" },
  ] }],
  checks: [], matchedDrawnBeamIds: [],
};

it("draws short fading guides at the laser and both sides of the mirror", () => {
  const guide = traceGuideGeometry(trace, []);
  const x = Array.from(guide.positions).filter((_, index) => index % 3 === 0);
  assert.deepEqual([x[0], x[7], x[8], x[15], x[16], x[23]], [0, 40, 200, 160, 200, 240]);
  assert.equal(Math.max(...x), 240);
  assert.equal(guide.opacity[0], guide.opacity[16]);
  assert.equal(guide.opacity[7], 0);
  assert.equal(guide.positions[1], 100);
});

it("leaves hidden branches out of the guide", () => {
  assert.equal(traceGuideGeometry({ ...trace, matchedDrawnBeamIds: ["beam"] }, [{ id: "beam", path: ["laser", "mirror"], color: "#ffffff", hidden: true }]).positions.length, 0);
});

it("hides only the traced paths that follow a hidden Beam, not its laser's other branches", () => {
  const part = (type: BuilderComponent["type"], id: string, x: number, z: number, yaw = 0): BuilderComponent =>
    ({ ...newComponent(type, id, x, z), position: [x, 100, z], orientation: fromYawDeg(yaw) });
  const split = traceScene({
    version: SCENE_VERSION, beams: [], connections: [], frames: [], groups: [],
    components: [
      part("laser-source", "laser", 0, 0), part("beam-splitter", "cube", 100, 0),
      part("photodiode", "through", 200, 0), part("photodiode", "reflected", 100, 100, 90),
    ],
  });
  const [tree] = split.trees;
  const reflectedOnly = { ...split, trees: [{ ...tree, segments: tree.segments.filter((segment) => segment.toId === "reflected") }] };
  assert.equal(reflectedOnly.trees[0].segments.length, 1);
  const hidden: Beam[] = [{ id: "through", path: ["laser", "cube", "through"], color: "#ffffff", hidden: true }];
  assert.deepEqual(traceGuideGeometry(split, hidden), traceGuideGeometry(reflectedOnly, []));
});
