import assert from "node:assert/strict";
import { it } from "node:test";

import { fromYawDeg } from "./quaternion.ts";
import { traceRoutes, looseTraceChecks } from "./trace-routes.ts";
import { traceScene } from "./trace-scene.ts";
import { SCENE_VERSION, type BuilderComponent, type BuilderSceneData } from "./types.ts";

const part = (id: string, type: BuilderComponent["type"], x: number, z: number, yaw = 0): BuilderComponent => ({
  id, type, position: [x, 100, z], orientation: fromYawDeg(yaw),
});

const setup = (endX: number): BuilderSceneData => ({
  version: SCENE_VERSION,
  components: [
    part("laser", "laser-source", 0, 0), part("split", "beam-splitter", 100, 0),
    part("through", "photodiode", endX, 0), part("reflected", "photodiode", 100, 100, 90),
  ],
  beams: [], connections: [], frames: [], groups: [],
});

it("keeps route ids and row order when a stop moves", () => {
  const before = traceRoutes(traceScene(setup(200)), []);
  const after = traceRoutes(traceScene(setup(250)), []);
  assert.deepEqual(before.map((route) => route.id), after.map((route) => route.id));
  assert.equal(before.length, 2);
  assert.deepEqual(before.map((route) => route.endId), ["through", "reflected"]);
  assert.notEqual(before[0].lengthMm, after[0].lengthMm);
  assert.deepEqual(before.map((route) => route.power), [0.5, 0.5]);
});

it("attributes a saved Beam and its check to the route it follows", () => {
  const scene = setup(200);
  scene.beams = [{ id: "saved", path: ["laser", "split", "through"], color: "#dc2626", label: "probe" }];
  const trace = traceScene(scene);
  const routes = traceRoutes(trace, scene.beams);
  assert.equal(routes[0].beam?.id, "saved");
  assert.equal(routes[1].beam, null);
  assert.equal(looseTraceChecks(trace, routes).length, 0);
});
