import assert from "node:assert/strict";
import { it } from "node:test";

import { traceGuideGeometry } from "./trace-guide.ts";
import type { TraceResult } from "./trace-scene.ts";

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
});

it("leaves hidden branches out of the guide", () => {
  assert.equal(traceGuideGeometry(trace, [{ id: "beam", path: ["laser", "mirror"], color: "#ffffff", hidden: true }]).positions.length, 0);
});
