import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type Beam, type BuilderComponent, beamLineSnap, snapToBeamLine } from "./types.ts";

// #128: a part in the middle of a beam locks onto the straight line between
// the stops before and after it when dragged within about 5 mm.

const part = (id: string, x: number, z: number): BuilderComponent =>
  ({ id, type: "lens", position: [x, 100, z], rotation: 0 }) as unknown as BuilderComponent;
const beam = (id: string, path: string[]): Beam => ({ id, path, color: "#e33" });

describe("snapToBeamLine", () => {
  const a: [number, number, number] = [0, 100, 0];
  const b: [number, number, number] = [200, 100, 100];

  it("projects a nearby point onto the line", () => {
    const snapped = snapToBeamLine(100, 54, a, b);
    assert.ok(snapped);
    assert.ok(Math.abs(snapped[1] - snapped[0] / 2) < 1e-9);
    assert.ok(Math.hypot(snapped[0] - 100, snapped[1] - 54) <= 5);
  });

  it("leaves a point farther than the threshold alone", () => {
    assert.equal(snapToBeamLine(100, 70, a, b), undefined);
  });

  it("does not lock beyond the stops", () => {
    assert.equal(snapToBeamLine(-50, -25, a, b), undefined);
  });

  it("ignores coincident stops", () => {
    assert.equal(snapToBeamLine(1, 1, a, a), undefined);
  });
});

describe("beamLineSnap", () => {
  const components = [part("A", 0, 0), part("L", 100, 53), part("B", 200, 0), part("C", 200, 200)];

  it("uses the neighbours of a part in the middle of a beam", () => {
    const lock = beamLineSnap([beam("1", ["A", "L", "B"])], components, "L", 100, 2);
    assert.deepEqual(lock?.position, [100, 0]);
    assert.deepEqual(lock?.guide, [components[0].position, components[2].position]);
  });

  it("does nothing for a beam's first or last stop, or a part on no beam", () => {
    const beams = [beam("1", ["A", "L", "B"])];
    assert.equal(beamLineSnap(beams, components, "A", 0, 1), undefined);
    assert.equal(beamLineSnap(beams, components, "B", 200, 1), undefined);
    assert.equal(beamLineSnap(beams, components, "C", 200, 199), undefined);
  });

  it("takes the first beam in the list when several pass through", () => {
    const beams = [beam("1", ["A", "L", "C"]), beam("2", ["A", "L", "B"])];
    assert.equal(beamLineSnap(beams, components, "L", 100, 2), undefined);
    const lock = beamLineSnap([beams[1], beams[0]], components, "L", 100, 2);
    assert.deepEqual(lock?.position, [100, 0]);
  });
});
