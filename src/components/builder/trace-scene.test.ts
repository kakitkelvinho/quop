import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { settleAims } from "./aim-settling.ts";
import { fromYawDeg, fromYawPitchRollDeg } from "./quaternion.ts";
import { traceScene, tracedBeamLengthMm } from "./trace-scene.ts";
import { DEFAULT_SCENE, newComponent, parseScene, SCENE_VERSION, type BuilderComponent, type BuilderSceneData } from "./types.ts";

function part(type: BuilderComponent["type"], id: string, x: number, y: number, z: number, yaw = 0): BuilderComponent {
  return { ...newComponent(type, id, x, z), position: [x, y, z], orientation: fromYawDeg(yaw) };
}

function scene(components: BuilderComponent[]): BuilderSceneData {
  return { version: SCENE_VERSION, components, beams: [], connections: [], frames: [], groups: [] };
}

describe("traceScene", () => {
  it("traces both branches of the starting Setup", () => {
    const result = traceScene(settleAims(DEFAULT_SCENE).scene);
    assert.deepEqual(result.matchedDrawnBeamIds, DEFAULT_SCENE.beams.map((beam) => beam.id));
    assert.ok(!result.checks.some((check) => check.kind === "path-mismatch"));
    assert.ok(tracedBeamLengthMm(result, DEFAULT_SCENE.beams[0])! > 0);
  });

  it("follows two 45° mirrors through the expected 3D stops", () => {
    const result = traceScene(scene([
      part("laser-source", "laser", 0, 100, 0),
      part("mirror-mount", "m1", 100, 100, 0, 45),
      part("mirror-mount", "m2", 100, 100, 100, 45),
      part("photodiode", "pd", 200, 100, 100),
    ]));
    const segments = result.trees[0].segments;
    assert.deepEqual(segments.slice(0, 3).map((segment) => segment.toId), ["m1", "m2", "pd"]);
    for (const [index, want] of ([[100, 100, 0], [100, 100, 100], [200, 100, 100]] as const).entries()) {
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(segments[index].toMm[axis] - want[axis]) < 1e-9);
    }
    assert.ok(Math.abs(segments[2].pathLengthMm - 300) < 1e-9);
  });

  it("branches at a Beam cube and conserves power", () => {
    const result = traceScene(scene([
      part("laser-source", "laser", 0, 100, 0),
      part("beam-splitter", "cube", 100, 100, 0),
      part("photodiode", "through", 200, 100, 0),
      part("photodiode", "reflected", 100, 100, 100, 90),
    ]));
    const ends = result.trees[0].segments.filter((segment) => segment.toId === "through" || segment.toId === "reflected");
    assert.deepEqual(ends.map((segment) => segment.toId), ["through", "reflected"]);
    assert.deepEqual(ends.map((segment) => segment.power), [0.5, 0.5]);
  });

  it("sends light above the Table when a Mirror pitches out of plane", () => {
    const mirror = part("mirror-mount", "mirror", 100, 100, 0);
    mirror.orientation = fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: -45, rollDeg: 0 });
    const high = part("photodiode", "high", 100, 200, 0);
    high.orientation = fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: 90, rollDeg: 0 });
    const result = traceScene(scene([part("laser-source", "laser", 0, 100, 0), mirror, high]));
    assert.deepEqual(result.trees[0].segments.slice(0, 2).map((segment) => segment.toId), ["mirror", "high"]);
  });

  it("includes internal and Delay line paths in the measured length", () => {
    const laser = { ...part("laser-source", "laser", 0, 100, 0), internalPathMm: 40 };
    const delay = { ...part("delay-line", "delay", 100, 100, 0, 90), delayMinPathMm: 200, delayStageMm: 10 };
    const result = traceScene(scene([laser, delay, part("photodiode", "pd", 200, 100, 0)]));
    const end = result.trees[0].segments.find((segment) => segment.toId === "pd");
    assert.equal(end?.pathLengthMm, 460);
  });

  describe("a Delay line across the line (#360)", () => {
    const delayScene = (yaw: number, z = 0, y = 100) => scene([
      part("laser-source", "laser", 0, 100, 0),
      { ...part("delay-line", "delay", 100, y, z, yaw), delayMinPathMm: 200, delayStageMm: 10 },
      part("photodiode", "pd", 200, 100, 0),
    ]);
    const toDetector = (data: BuilderSceneData) => traceScene(data).trees[0].segments.find((segment) => segment.toId === "pd");

    for (const yaw of [90, 270]) {
      it(`adds its delay at yaw ${yaw} and leaves on the line it came in on`, () => {
        const end = toDetector(delayScene(yaw));
        assert.deepEqual(end?.path, ["laser", "delay", "pd"]);
        assert.equal(end?.pathLengthMm, 200 + 200 + 2 * 10);
        assert.deepEqual(end?.fromMm, [100, 100, 0]);
      });
    }

    it("turns itself across the line from yaw 0, keeping the side it faces", () => {
      for (const [from, to] of [[0, 90], [30, 90], [200, 270], [300, 270]]) {
        const settled = settleAims(delayScene(from)).scene;
        const delay = settled.components.find((component) => component.id === "delay")!;
        assert.deepEqual(delay.orientation, fromYawDeg(to), `from ${from}`);
        assert.equal(toDetector(settled)?.pathLengthMm, 420);
      }
    });

    it("keeps its orientation with no Component before it", () => {
      const lone = scene([part("delay-line", "delay", 100, 100, 0, 30)]);
      assert.equal(settleAims(lone).scene, lone);
    });

    it("blocks a Beam that misses its port, off the line or at the wrong height", () => {
      // at yaw 90 the stage runs back from the port toward +z, at 270 toward −z
      for (const data of [delayScene(90, -20), delayScene(270, 20), delayScene(90, 0, 120)]) {
        const result = traceScene(data);
        assert.deepEqual(result.trees[0].segments.map((segment) => segment.toId), ["delay"]);
        assert.ok(result.checks.some((check) => check.kind === "blocked" && check.componentId === "delay"));
      }
    });
  });

  it("caps total segments per laser even when a Beam cube branches", () => {
    const data = scene([
      part("laser-source", "laser", 0, 100, 0), part("beam-splitter", "cube", 100, 100, 0),
      part("photodiode", "through", 200, 100, 0), part("photodiode", "reflected", 100, 100, 100, 90),
    ]);
    const result = traceScene(data, { maxSegmentsPerLaser: 3 });
    assert.equal(result.trees[0].segments.length, 3);
    assert.ok(result.checks.some((check) => check.kind === "segment-limit"));
    assert.deepEqual(traceScene(data, { maxSegmentsPerLaser: 3 }), result);
    assert.equal(data.components[0].position[0], 0);
  });

  it("reports blocked light and a Mirror waiting for light", () => {
    const result = traceScene(scene([
      part("laser-source", "laser", 0, 100, 0), part("beam-block", "dump", 100, 100, 0),
      part("mirror-mount", "unused", 200, 100, 200),
    ]));
    assert.ok(result.checks.some((check) => check.kind === "blocked" && check.componentId === "dump"));
    assert.ok(result.checks.some((check) => check.kind === "waiting-for-light" && check.componentId === "unused"));
  });

  it("reports a Beam that crosses a Component body outside its aperture", () => {
    const result = traceScene(scene([
      part("laser-source", "laser", 0, 100, 0), part("iris", "iris", 100, 107, 0),
    ]));
    assert.ok(result.checks.some((check) => check.kind === "missed-aperture" && check.componentId === "iris"));
  });

  it("matches a drawn Beam to a trace and reports one at the wrong height", () => {
    const aligned = scene([part("laser-source", "laser", 0, 100, 0), part("photodiode", "pd", 200, 100, 0)]);
    aligned.beams = [{ id: "drawn", path: ["laser", "pd"], color: "#ffffff" }];
    assert.deepEqual(traceScene(aligned).matchedDrawnBeamIds, ["drawn"]);
    assert.equal(tracedBeamLengthMm(traceScene(aligned), aligned.beams[0]), 200);
    const lifted = scene([part("laser-source", "laser", 0, 100, 0), part("photodiode", "pd", 200, 130, 0)]);
    lifted.beams = aligned.beams;
    const result = traceScene(lifted);
    assert.deepEqual(result.matchedDrawnBeamIds, []);
    assert.equal(tracedBeamLengthMm(result, lifted.beams[0]), undefined);
    assert.ok(result.checks.some((check) => check.kind === "wrong-height" && check.componentId === "pd"));
  });

  it("keeps every saved Beam while tracing all setup fixtures", () => {
    for (let version = 1; version <= SCENE_VERSION; version++) {
      const saved = JSON.parse(readFileSync(new URL(`./setup-fixtures/setup-v${version}.json`, import.meta.url), "utf8"));
      const opened = parseScene(saved);
      assert.ok(opened);
      const beamsBefore = structuredClone(opened.beams);
      const componentsBefore = structuredClone(opened.components);
      const result = traceScene(opened);
      assert.deepEqual(opened.beams, beamsBefore);
      assert.deepEqual(opened.components, componentsBefore);
      assert.ok(result.trees.every((tree) => tree.segments.length <= 256));
      if (version >= 14) assert.deepEqual(result.matchedDrawnBeamIds, opened.beams.map((beam) => beam.id));
      else assert.ok(result.checks.some((check) => check.kind === "path-mismatch" || check.kind === "wrong-height"));
    }
  });
});
