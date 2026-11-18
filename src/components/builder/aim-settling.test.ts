import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { aimAt, catchAims, flipFold, insertIntoAimedPath, settleAims } from "./aim-settling.ts";
import { length, normalize, type Vec3 } from "./quaternion.ts";
import { traceScene } from "./trace-scene.ts";
import { newComponent, SCENE_VERSION, type Beam, type BuilderComponent, type BuilderSceneData } from "./types.ts";

function part(type: BuilderComponent["type"], id: string, x: number, y: number, z: number): BuilderComponent {
  return { ...newComponent(type, id, x, z), position: [x, y, z] };
}

function scene(components: BuilderComponent[], beams: Beam[] = []): BuilderSceneData {
  return { version: SCENE_VERSION, components, beams, connections: [], frames: [], groups: [] };
}

function at(data: BuilderSceneData, id: string): BuilderComponent {
  const component = data.components.find((entry) => entry.id === id);
  assert.ok(component);
  return component;
}

function near(a: Vec3, b: Vec3, tolerance = 1e-8): void {
  assert.ok(length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]) < tolerance, `${a} differs from ${b}`);
}

describe("aim settling", () => {
  it("settles an aimed path in a few passes and traces through it", () => {
    const data = scene([
      part("laser-source", "laser", 0, 100, 0),
      { ...part("mirror-mount", "m1", 100, 100, 0), aim: "m2" },
      { ...part("mirror-mount", "m2", 100, 100, 100), aim: "pd" },
      part("photodiode", "pd", 200, 100, 100),
    ]);
    const settled = settleAims(data);
    assert.ok(settled.passes <= 4);
    assert.equal(settled.statuses.get("m1")?.kind, "aimed");
    assert.equal(settled.statuses.get("m2")?.kind, "aimed");
    assert.deepEqual(traceScene(settled.scene).trees[0].segments.slice(0, 3).map((segment) => segment.toId), ["m1", "m2", "pd"]);
  });

  it("flips an unaimed 45° Mirror to the other side and clears an aim", () => {
    const data = scene([part("laser-source", "laser", 0, 100, 0), part("mirror-mount", "m", 100, 100, 0)]);
    const first = traceScene(settleAims(data).scene).trees[0].segments[1];
    const flipped = flipFold(settleAims(data).scene, "m");
    const second = traceScene(settleAims(flipped).scene).trees[0].segments[1];
    assert.ok(first.toMm[2] > 0);
    assert.ok(second.toMm[2] < 0);
    assert.equal(at(flipped, "m").fold, -1);
    assert.equal(at(flipFold(aimAt(data, "m", "laser"), "m"), "m").aim, undefined);
  });

  it("catches a detector on release and follows it when dragged", () => {
    const data = scene([
      part("laser-source", "laser", 0, 100, 0), part("mirror-mount", "m", 100, 100, 0),
      { ...part("photodiode", "pd", 100, 100, 100), orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
    ]);
    const caught = catchAims(settleAims(data).scene);
    assert.equal(at(caught, "m").aim, "pd");
    const moved = { ...caught, components: caught.components.map((component) => component.id === "pd" ? { ...component, position: [150, 100, 100] as Vec3 } : component) };
    const settled = settleAims(moved).scene;
    const leaving = traceScene(settled).trees[0].segments.find((segment) => segment.fromId === "m");
    assert.ok(leaving);
    near(normalize([leaving.toMm[0] - leaving.fromMm[0], leaving.toMm[1] - leaving.fromMm[1], leaving.toMm[2] - leaving.fromMm[2]]), normalize([50, 0, 100]));
  });

  it("re-points an aimed Mirror when another Mirror is inserted into its light", () => {
    const data = scene([
      part("laser-source", "laser", 0, 100, 0),
      { ...part("mirror-mount", "m1", 100, 100, 0), aim: "pd" },
      part("mirror-mount", "m2", 100, 100, 100),
      part("photodiode", "pd", 100, 100, 200),
    ]);
    const next = insertIntoAimedPath(settleAims(data).scene, "m2");
    assert.equal(at(next, "m1").aim, "m2");
  });

  it("freezes its last angle when the aim target is removed", () => {
    const data = scene([
      part("laser-source", "laser", 0, 100, 0),
      { ...part("mirror-mount", "m", 100, 100, 0), aim: "pd" },
      part("photodiode", "pd", 100, 100, 100),
    ]);
    const settled = settleAims(data).scene;
    const without = { ...settled, components: settled.components.filter((component) => component.id !== "pd") };
    const result = settleAims(without);
    assert.deepEqual(at(result.scene, "m").orientation, at(settled, "m").orientation);
    assert.equal(result.statuses.get("m")?.kind, "waiting");
  });

  it("chooses the first Beams box aimer when two aim at the same Mirror", () => {
    const components = [
      part("laser-source", "laser1", 0, 100, 0), part("laser-source", "laser2", 0, 100, 200),
      { ...part("mirror-mount", "m1", 100, 100, 0), aim: "m3" },
      { ...part("mirror-mount", "m2", 100, 100, 200), aim: "m3" },
      { ...part("mirror-mount", "m3", 200, 100, 100), aim: "pd" },
      part("photodiode", "pd", 300, 100, 100),
    ];
    const first = { id: "first", path: ["laser1", "m1", "m3", "pd"], color: "#ffffff" };
    const second = { id: "second", path: ["laser2", "m2", "m3", "pd"], color: "#ffffff" };
    assert.equal(settleAims(scene(components, [first, second])).statuses.get("m3")?.previousId, "m1");
    assert.equal(settleAims(scene(components, [second, first])).statuses.get("m3")?.previousId, "m2");
  });

  it("points the traced reflection at every reachable aim target", () => {
    fc.assert(fc.property(
      fc.double({ min: 20, max: 200, noNaN: true }),
      fc.double({ min: 20, max: 200, noNaN: true }),
      (dx, dz) => {
        const data = scene([
          part("laser-source", "laser", 0, 100, 0),
          { ...part("mirror-mount", "m", 100, 100, 0), aim: "target" },
          part("photodiode", "target", 100 + dx, 100, dz),
        ]);
        const settled = settleAims(data).scene;
        const leaving = traceScene(settled).trees[0].segments.find((segment) => segment.fromId === "m");
        assert.ok(leaving);
        near(normalize([leaving.toMm[0] - leaving.fromMm[0], leaving.toMm[1] - leaving.fromMm[1], leaving.toMm[2] - leaving.fromMm[2]]), normalize([dx, 0, dz]), 1e-7);
      },
    ));
  });
});
