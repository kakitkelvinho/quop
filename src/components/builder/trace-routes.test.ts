import assert from "node:assert/strict";
import { it } from "node:test";

import { fromYawDeg } from "./quaternion.ts";
import { traceRoutes, tracedDistanceLegs, looseTraceChecks } from "./trace-routes.ts";
import { traceScene, type TraceResult } from "./trace-scene.ts";
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

it("shows two saved beams beginning at an Objective on separate laser routes", () => {
  const path = ["objective", "detector"];
  const beams = [
    { id: "first", path, color: "#ffffff" },
    { id: "second", path, color: "#dc2626" },
  ];
  const segment = (laserId: string) => ({
    fromMm: [0, 100, 0] as [number, number, number], toMm: [200, 100, 0] as [number, number, number],
    fromId: "objective", toId: "detector", path: [laserId, ...path],
    power: 1, pathLengthMm: 200, arm: "through" as const,
  });
  const trace: TraceResult = {
    trees: [
      { laserId: "laser-a", segments: [segment("laser-a")] },
      { laserId: "laser-b", segments: [segment("laser-b")] },
    ],
    checks: [], matchedDrawnBeamIds: beams.map((beam) => beam.id),
  };
  assert.deepEqual(traceRoutes(trace, beams).map((route) => route.beam?.id), ["first", "second"]);
});

it("lets one saved trunk style both branches from its Laser", () => {
  const scene = setup(200);
  scene.beams = [{ id: "trunk", path: ["laser", "split"], color: "#dc2626" }];
  const routes = traceRoutes(traceScene(scene), scene.beams);
  assert.deepEqual(routes.map((route) => route.beam?.id), ["trunk", "trunk"]);
});

it("measures each part-to-part leg of unsaved traced light once", () => {
  const scene = setup(200);
  const legs = tracedDistanceLegs(traceRoutes(traceScene(scene), []), scene.components);
  assert.deepEqual(legs.map((leg) => [leg.fromId, leg.toId, leg.lengthMm]), [
    ["laser", "split", 100],
    ["split", "through", 100],
    ["split", "reflected", 100],
  ]);
});
