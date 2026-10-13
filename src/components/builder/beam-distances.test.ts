import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Beam, type BuilderComponent, DELAY_RANGE_MM, beamLegLengthsMm } from "./types.ts";

// The distance labels along a beam: one per leg, the straight run between
// reference points, plus a passed delay line's shortest round trip.

const laser: BuilderComponent = { id: "laser", type: "laser-source", position: [0, 100, 0], rotation: 0 };
const m1: BuilderComponent = { id: "m1", type: "mirror-mount", position: [300, 100, 0], rotation: 0 };
const m2: BuilderComponent = { id: "m2", type: "mirror-mount", position: [300, 100, 400], rotation: 0 };
const delay: BuilderComponent = { id: "delay", type: "delay-line", position: [600, 100, 0], rotation: 0, delayMm: 200 };
const beam = (path: string[]): Beam => ({ id: "b", path, color: "#e33" });

describe("beamLegLengthsMm", () => {
  it("measures each leg between reference points, in 3D", () => {
    const raised = { ...m2, position: [300, 400, 400] as [number, number, number] };
    assert.deepEqual(beamLegLengthsMm([laser, m1, raised], beam(["laser", "m1", "m2"])), [300, 500]);
  });

  it("adds a passed delay line's shortest round trip to the leg into it, whatever its arm", () => {
    const parts = [m1, delay, m2];
    const [into, out] = beamLegLengthsMm(parts, beam(["m1", "delay", "m2"]));
    assert.equal(into, 300 + 2 * DELAY_RANGE_MM[0]);
    assert.equal(out, Math.hypot(300, 400));

    const custom = { ...delay, delayMinMm: 80, delayMm: 900 };
    assert.equal(beamLegLengthsMm([m1, custom, m2], beam(["m1", "delay", "m2"]))[0], 300 + 160);
  });

  it("adds nothing for a delay line the beam ends at, as the total doesn't", () => {
    assert.deepEqual(beamLegLengthsMm([m1, delay], beam(["m1", "delay"])), [300]);
  });

  it("leaves a laser's built-in path out of the first leg", () => {
    const long = { ...laser, internalPathMm: 4000 };
    assert.deepEqual(beamLegLengthsMm([long, m1], beam(["laser", "m1"])), [300]);
  });

  it("skips a stop whose part is gone", () => {
    assert.deepEqual(beamLegLengthsMm([laser, m2], beam(["laser", "gone", "m2"])), [Math.hypot(300, 400)]);
  });
});
