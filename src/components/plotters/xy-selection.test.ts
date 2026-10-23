import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ROW_NUMBER, addY, resolveY, swapX, toggleY, yCandidates } from "./xy-selection.ts";

describe("resolveY", () => {
  it("plots every candidate before the user chooses", () => {
    assert.deepEqual(resolveY(null, yCandidates(4, 0)), [1, 2, 3]);
  });

  it("plots nothing once the user has unticked every Y", () => {
    assert.deepEqual(resolveY([], yCandidates(4, 0)), []);
  });

  it("keeps only the chosen Ys still on offer", () => {
    assert.deepEqual(resolveY([0, 2, 9], yCandidates(4, 0)), [2]);
  });

  it("offers every column as Y when X is Row number", () => {
    assert.deepEqual(yCandidates(3, ROW_NUMBER), [0, 1, 2]);
  });
});

describe("swapX", () => {
  it("takes the new X out of the Ys and puts the old X back", () => {
    assert.deepEqual(swapX([1, 3], 0, 3), [0, 1]);
  });

  it("does not put Row number back into the Ys", () => {
    assert.deepEqual(swapX([1, 2], ROW_NUMBER, 2), [1]);
  });

  it("puts a column back when X becomes Row number", () => {
    assert.deepEqual(swapX([2], 1, ROW_NUMBER), [1, 2]);
  });

  it("leaves a choice not made yet unmade", () => {
    assert.equal(swapX(null, 0, 2), null);
  });

  it("keeps an empty choice empty but for the old X", () => {
    assert.deepEqual(swapX([], 0, 1), [0]);
  });
});

describe("toggleY and addY", () => {
  it("ticks in column order and unticks", () => {
    assert.deepEqual(toggleY([3], 1, true), [1, 3]);
    assert.deepEqual(toggleY([1, 3], 1, false), [3]);
    assert.deepEqual(toggleY([1], 1, true), [1]);
  });

  it("adds the shown Ys to the ticked ones", () => {
    assert.deepEqual(addY([5, 1], [3, 1]), [1, 3, 5]);
  });
});
