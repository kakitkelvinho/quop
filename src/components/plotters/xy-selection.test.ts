import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLOTTED_LIMIT,
  ROW_NUMBER,
  addY,
  limitY,
  resolveY,
  swapX,
  toggleY,
  yCandidates,
} from "./xy-selection.ts";

describe("resolveY", () => {
  it("plots every candidate before the user chooses, when there are few", () => {
    assert.deepEqual(resolveY(null, yCandidates(4, 0)), [1, 2, 3]);
    assert.equal(resolveY(null, yCandidates(7, 0)).length, 6);
  });

  it("starts a 17 088-series read with the first 10 plotted, skipping X", () => {
    const plotted = resolveY(null, yCandidates(17089, 0));

    assert.deepEqual(plotted, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("plots nothing once the user has unticked every Y", () => {
    assert.deepEqual(resolveY([], yCandidates(4, 0)), []);
  });

  it("keeps only the chosen Ys still on offer", () => {
    assert.deepEqual(resolveY([0, 2, 9], yCandidates(4, 0)), [2]);
  });

  it("never offers a clock column as Y", () => {
    assert.deepEqual(yCandidates(4, 0, [1]), [2, 3]);
    assert.deepEqual(yCandidates(4, 1, [1]), [0, 2, 3]);
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

  it("does not put a clock column back into the Ys", () => {
    assert.deepEqual(swapX([2, 3], 1, 0, [1]), [2, 3]);
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

describe("limitY", () => {
  it("lets a choice under the limit through", () => {
    assert.deepEqual(limitY([1], [1, 2]), { plotted: [1, 2], limited: false });
  });

  it("ticks up to 500 when All is pressed on 17 088 series", () => {
    const candidates = yCandidates(17089, 0);
    const current = resolveY(null, candidates);
    const { plotted, limited } = limitY(current, addY(current, candidates));

    assert.equal(plotted.length, PLOTTED_LIMIT);
    assert.equal(limited, true);
    assert.deepEqual(plotted.slice(0, 10), current);
  });

  it("refuses a tick past the limit", () => {
    const full = Array.from({ length: 3 }, (_, index) => index * 2);
    const result = limitY(full, toggleY(full, 1, true), 3);

    assert.deepEqual(result, { plotted: [0, 2, 4], limited: true });
  });
});
