import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { measureBeam } from "./beam-measurement.ts";
import { type Beam, type BuilderComponent, DELAY_MIN_PATH_MM } from "./types.ts";

// The distance labels along a beam: one per leg, the straight run between
// reference points, plus a passed delay line's minimum delay.

const laser: BuilderComponent = { id: "laser", type: "laser-source", position: [0, 100, 0], rotation: 0 };
const m1: BuilderComponent = { id: "m1", type: "mirror-mount", position: [300, 100, 0], rotation: 0 };
const m2: BuilderComponent = { id: "m2", type: "mirror-mount", position: [300, 100, 400], rotation: 0 };
const delay: BuilderComponent = { id: "delay", type: "delay-line", position: [600, 100, 0], rotation: 0, delayStageMm: 20 };
const beam = (path: string[]): Beam => ({ id: "b", path, color: "#e33" });

describe("Beam distance labels", () => {
  it("measures each leg between reference points, in 3D", () => {
    const raised = { ...m2, position: [300, 400, 400] as [number, number, number] };
    const result = measureBeam([laser, m1, raised], beam(["laser", "m1", "m2"]));
    assert.deepEqual(result.points, [laser.position, m1.position, raised.position]);
    assert.deepEqual(result.legLengthsMm, [300, 500]);
    assert.equal(result.lengthMm, 800);
    assert.equal(result.timeOfFlightPs, (800 / 299.792458) * 1000);
  });

  it("adds a passed delay line's minimum delay to the leg into it, wherever its stage is", () => {
    const parts = [m1, delay, m2];
    const [into, out] = measureBeam(parts, beam(["m1", "delay", "m2"])).legLengthsMm;
    assert.equal(into, 300 + DELAY_MIN_PATH_MM);
    assert.equal(out, Math.hypot(300, 400));

    const custom = { ...delay, delayMinPathMm: 160, delayStageMm: 40 };
    assert.equal(measureBeam([m1, custom, m2], beam(["m1", "delay", "m2"])).legLengthsMm[0], 300 + 160);
  });

  it("adds nothing for a delay line the beam ends at, as the total doesn't", () => {
    const result = measureBeam([m1, delay], beam(["m1", "delay"]));
    assert.deepEqual(result.legLengthsMm, [300]);
    assert.equal(result.delayLineMm, 0);
  });

  it("leaves a laser's built-in path out of the first leg", () => {
    const long = { ...laser, internalPathMm: 4000 };
    assert.deepEqual(measureBeam([long, m1], beam(["laser", "m1"])).legLengthsMm, [300]);
  });

  it("skips a stop whose part is gone", () => {
    const result = measureBeam([laser, m2], beam(["laser", "gone", "m2"]));
    assert.deepEqual(result.points, [laser.position, m2.position]);
    assert.deepEqual(result.legLengthsMm, [Math.hypot(300, 400)]);
    assert.equal(result.lengthMm, 500);
  });
});
