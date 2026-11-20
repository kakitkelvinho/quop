import assert from "node:assert/strict";
import { it } from "node:test";

import { fromYawDeg } from "./quaternion.ts";
import { traceGuideGeometry } from "./trace-guide.ts";
import { LASER_LIGHT_COLORS, laserLightColor, nextLaserLightColor, parseScene, serializeScene, type BuilderComponent } from "./types.ts";

const laser = (id: string, lightColor?: string): BuilderComponent => ({
  id, type: "laser-source", position: [0, 100, 0], orientation: fromYawDeg(0),
  ...(lightColor ? { lightColor } : {}),
});

it("keeps old lasers without a saved colour and renders them orange", () => {
  const opened = parseScene({ version: 20, components: [{ ...laser("old"), lightColor: "#22b8cf" }] })!;
  assert.equal(opened.components[0].lightColor, undefined);
  assert.equal(laserLightColor(opened.components[0]), LASER_LIGHT_COLORS[0]);
  assert.equal(JSON.parse(serializeScene(opened)).components[0].lightColor, undefined);
});

it("saves a new laser colour, while retaining older cavity colours", () => {
  const opened = parseScene({ version: 21, components: [laser("new", "#22b8cf"), {
    id: "cavity", type: "cavity", position: [0, 100, 0], orientation: fromYawDeg(0), lightColor: "#16a34a",
  }] })!;
  assert.equal(opened.components[0].lightColor, "#22b8cf");
  assert.equal(opened.components[1].lightColor, "#16a34a");
  assert.deepEqual(parseScene(JSON.parse(serializeScene(opened))), opened);
});

it("uses the first free colour, counting old lasers' displayed orange", () => {
  assert.equal(nextLaserLightColor([]), LASER_LIGHT_COLORS[0]);
  assert.equal(nextLaserLightColor([laser("old")]), LASER_LIGHT_COLORS[1]);
  assert.equal(nextLaserLightColor([laser("old"), laser("cyan", LASER_LIGHT_COLORS[1])]), LASER_LIGHT_COLORS[2]);
  assert.equal(nextLaserLightColor(LASER_LIGHT_COLORS.map((color, index) => laser(String(index), color))), LASER_LIGHT_COLORS[0]);
});

it("keeps each guide vertex tied to the laser that emitted it", () => {
  const trace = { trees: ["a", "b"].map((laserId) => ({ laserId, segments: [{
    fromMm: [0, 100, 0] as [number, number, number], toMm: [100, 100, 0] as [number, number, number],
    fromId: laserId, toId: null, path: [laserId], power: 1, pathLengthMm: 100, arm: "through" as const,
  }] })), checks: [], matchedDrawnBeamIds: [] };
  const guide = traceGuideGeometry(trace, []);
  assert.deepEqual([...new Set(guide.laserIds)], ["a", "b"]);
  assert.equal(guide.laserIds.length, guide.opacity.length);
});
