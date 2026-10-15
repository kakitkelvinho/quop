import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { beamsHit, pickBeam } from "./beam-pick.ts";

// Clicking a beam on the table: the nearest under the pointer, and clicking
// the same spot again cycles through the beams that overlap there.

const hit = (beamId?: string) => ({ object: { userData: beamId ? { beamId } : {} } });

describe("beamsHit", () => {
  it("lists each beam once, nearest first, skipping hits that aren't beams", () => {
    assert.deepEqual(beamsHit([hit("a"), hit(), hit("b"), hit("a")]), ["a", "b"]);
  });
});

describe("pickBeam", () => {
  it("picks the nearest beam on a first click", () => {
    assert.equal(pickBeam(null, ["a", "b"], 100, 100).index, 0);
  });

  it("moves to the next beam on a second click at the same spot, and wraps round", () => {
    const first = pickBeam(null, ["a", "b", "c"], 100, 100);
    const second = pickBeam(first, ["a", "b", "c"], 102, 99);
    const third = pickBeam(second, ["a", "b", "c"], 100, 100);
    const fourth = pickBeam(third, ["a", "b", "c"], 100, 100);
    assert.deepEqual([second.index, third.index, fourth.index], [1, 2, 0]);
  });

  it("still cycles if the hits come back in a different order", () => {
    const first = pickBeam(null, ["a", "b"], 100, 100);
    assert.equal(pickBeam(first, ["b", "a"], 100, 100).index, 1);
  });

  it("starts again at the nearest when the click moves away", () => {
    const first = pickBeam(null, ["a", "b"], 100, 100);
    assert.equal(pickBeam(first, ["a", "b"], 140, 100).index, 0);
  });

  it("starts again at the nearest when different beams are under the click", () => {
    const first = pickBeam(null, ["a", "b"], 100, 100);
    assert.equal(pickBeam(first, ["a", "c"], 100, 100).index, 0);
  });
});
