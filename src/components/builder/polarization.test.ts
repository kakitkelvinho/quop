import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";

import { fromYawDeg, fromYawPitchRollDeg, type Vec3 } from "./quaternion.ts";
import {
  component, faradayField, mirrorField, norm2, pbsFields, polarizationLabel, polarizationState,
  polarizerField, sourceField, waveplateField,
} from "./polarization.ts";
import { traceScene } from "./trace-scene.ts";
import { applyRule } from "./surface.ts";
import { fieldValue, parseScene, SCENE_VERSION, type BuilderComponent, type BuilderSceneData } from "./types.ts";

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];
const diagonal: Vec3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

function part(type: BuilderComponent["type"], id: string, x: number, z: number, yaw = 0): BuilderComponent {
  return { id, type, position: [x, 100, z], orientation: fromYawDeg(yaw) };
}

function scene(components: BuilderComponent[]): BuilderSceneData {
  return { version: SCENE_VERSION, components, beams: [], connections: [], frames: [], groups: [] };
}

function endPower(data: BuilderSceneData, endId: string): number {
  const segment = traceScene(data).trees[0].segments.find((candidate) => candidate.toId === endId);
  assert.ok(segment, `${endId} was reached`);
  return segment.power;
}

describe("polarization across surfaces", () => {
  it("turns horizontal light into two equal PBS ports at a half-wave fast axis of 22.5°", () => {
    const plate = part("waveplate", "hwp", 100, 0);
    plate.orientation = fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: 0, rollDeg: 22.5 });
    const data = scene([
      part("laser-source", "laser", 0, 0),
      plate,
      { ...part("beam-splitter", "cube", 200, 0), cubeMode: "polarizing" },
      part("photodiode", "through", 300, 0),
      part("photodiode", "reflected", 200, 100, 90),
    ]);
    near(endPower(data, "through"), 0.5);
    near(endPower(data, "reflected"), 0.5);
  });

  it("projects horizontal light at a 45° Polarizer, leaving 25% in each PBS port", () => {
    const polarizer = part("polarizer", "polarizer", 100, 0);
    polarizer.orientation = fromYawPitchRollDeg({ yawDeg: 0, pitchDeg: 0, rollDeg: 45 });
    const data = scene([
      part("laser-source", "laser", 0, 0),
      polarizer,
      { ...part("beam-splitter", "cube", 200, 0), cubeMode: "polarizing" },
      part("photodiode", "through", 300, 0),
      part("photodiode", "reflected", 200, 100, 90),
    ]);
    near(endPower(data, "through"), 0.25);
    near(endPower(data, "reflected"), 0.25);
    const loss = traceScene(data).losses?.find((entry) => entry.componentId === "polarizer");
    assert.ok(loss);
    near(loss.power, 0.5);
  });

  it("keeps the reflected route identity when a PBS has only one live output", () => {
    const data = scene([
      { ...part("laser-source", "laser", 0, 0), polarizationAngleDeg: 90 },
      { ...part("beam-splitter", "cube", 100, 0), cubeMode: "polarizing" },
      part("photodiode", "reflected", 100, 100, 90),
    ]);
    const trace = traceScene(data);
    const reflected = trace.trees[0].segments.find((segment) => segment.toId === "reflected");
    assert.ok(reflected);
    near(reflected.power, 1);
    assert.equal(reflected.arm, "reflected");
    assert.match(reflected.routeId!, /cube:reflected$/);
  });

  it("gives older cubes their saved 50/50 behavior, even if their label says PBS", () => {
    const saved = { version: 21, components: [
      part("laser-source", "laser", 0, 0),
      { ...part("beam-splitter", "cube", 100, 0), label: "PBS", cubeMode: "polarizing" },
      part("photodiode", "through", 200, 0),
      part("photodiode", "reflected", 100, 100, 90),
    ], beams: [], connections: [], frames: [], groups: [] };
    const opened = parseScene(saved);
    assert.ok(opened);
    const cube = opened.components.find((component) => component.id === "cube")!;
    assert.equal(fieldValue(cube, "cubeMode"), "non-polarizing");
    near(endPower(opened, "through"), 0.5);
    near(endPower(opened, "reflected"), 0.5);
    const reflected = traceScene(opened).trees[0].segments.find((segment) => segment.toId === "reflected")!;
    assert.ok(reflected.field);
    near(Math.hypot(component(reflected.field, reflected.direction!).re, component(reflected.field, reflected.direction!).im), 0);
  });

  it("carries the field into a thin lens's bent direction", () => {
    const input = sourceField(Z, Y, 90);
    const outgoing = applyRule(
      { kind: "thin-lens", focalLengthMm: 100 }, X,
      { originMm: [-10, 1, 0], direction: X, power: 1, field: input },
      [0, 1, 0], [0, 0, 0],
    )[0];
    assert.ok(outgoing.field);
    near(Math.hypot(component(outgoing.field, outgoing.direction).re, component(outgoing.field, outgoing.direction).im), 0);
    near(outgoing.power, 1);
  });

  it("makes 45° linear light circular after a 90° mirror retardance, without power loss", () => {
    const input = sourceField(Z, Y, 45);
    const output = mirrorField(input, X, Z, diagonal, 90);
    assert.equal(polarizationLabel(output, Z), "circular");
    near(norm2(output), 1);
    near(Math.hypot(component(output, Z).re, component(output, Z).im), 0);
  });

  it("reads linear light as an angle from horizontal and names the two axes", () => {
    assert.deepEqual(polarizationState(sourceField(X, Y, 0), Z), { kind: "linear", angleDeg: 0 });
    near((polarizationState(sourceField(X, Y, 30), Z) as { angleDeg: number }).angleDeg, 30);
    near((polarizationState(sourceField(X, Y, -30), Z) as { angleDeg: number }).angleDeg, -30);
    assert.equal(polarizationLabel(sourceField(X, Y, 0), Z), "horizontal");
    assert.equal(polarizationLabel(sourceField(X, Y, 90), Z), "vertical");
    assert.equal(polarizationLabel(sourceField(X, Y, 30), Z), "linear 30°");
  });

  it("turns the field through a vertical mirror bend and keeps it transverse", () => {
    const normal: Vec3 = [Math.SQRT1_2, -Math.SQRT1_2, 0];
    const input = sourceField(Z, Y, 30);
    const output = mirrorField(input, X, [0, 1, 0], normal);
    near(Math.hypot(component(output, [0, 1, 0]).re, component(output, [0, 1, 0]).im), 0);
    near(norm2(output), 1);
  });

  it("adds Faraday rotation on a return pass, so the input Polarizer rejects it", () => {
    const input = sourceField(Z, Y, 0);
    const once = faradayField(input, X, X, 45);
    const twice = faradayField(once, [-1, 0, 0], X, 45);
    near(polarizerField(twice, [-1, 0, 0], Z).fraction, 0);
    near(norm2(twice), 1);
  });

  it("conserves power through an ideal HWP and PBS for arbitrary linear source and plate angles", () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 180, noNaN: true }),
      fc.double({ min: -90, max: 90, noNaN: true }),
      (sourceAngle, plateAngle) => {
        const input = sourceField(Z, Y, sourceAngle);
        const axis: Vec3 = [0, Math.sin(plateAngle * Math.PI / 180), Math.cos(plateAngle * Math.PI / 180)];
        const field = waveplateField(input, X, axis, Math.PI);
        const split = pbsFields(field, X, diagonal);
        near(norm2(field), 1, 1e-8);
        near((split.through?.fraction ?? 0) + (split.reflected?.fraction ?? 0), 1, 1e-8);
      },
    ));
  });
});
