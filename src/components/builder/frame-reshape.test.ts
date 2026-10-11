import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dragGrip, moveCorner, moveSide } from "./frame-reshape.ts";
import { type Corner, TABLE_GUARD_MM, isValidOutline, normaliseCorners, rectangleCorners } from "./types.ts";

// #156: a selected frame reshapes by its sides and corners. A side moves
// perpendicular to itself, a corner drags both its sides along, and a drag
// that would fold the outline stops at the last place it could go.

/** An L, 850 × 250 overall, in standard form: sides 1 and 3 run along z, 2 is the leg's foot. */
const L_SHAPE: Corner[] = [
  [0, 0],
  [850, 0],
  [850, 250],
  [700, 250],
  [700, 100],
  [0, 100],
];

describe("dragging a side", () => {
  it("widens an L by its outer side, its neighbours stretching", () => {
    assert.deepEqual(moveSide(L_SHAPE, 1, 1000), [
      [0, 0],
      [1000, 0],
      [1000, 250],
      [700, 250],
      [700, 100],
      [0, 100],
    ]);
  });

  it("moves an L's step, the leg growing wider", () => {
    assert.deepEqual(moveSide(L_SHAPE, 3, 600), [
      [0, 0],
      [850, 0],
      [850, 250],
      [600, 250],
      [600, 100],
      [0, 100],
    ]);
  });

  it("moves the side that wraps from the last corner to the first", () => {
    assert.deepEqual(moveSide(L_SHAPE, 5, -100), [
      [-100, 0],
      [850, 0],
      [850, 250],
      [700, 250],
      [700, 100],
      [-100, 100],
    ]);
  });

  it("grows a step where a neighbour runs straight on, rather than slanting it", () => {
    // the back runs as two sides, from 0 to 400 and on to 800
    const jointed: Corner[] = [
      [0, 0],
      [400, 0],
      [800, 0],
      [800, 200],
      [0, 200],
    ];
    const moved = moveSide(jointed, 0, -100);
    assert.deepEqual(moved, [
      [0, -100],
      [400, -100],
      [400, 0],
      [800, 0],
      [800, 200],
      [0, 200],
    ]);
    assert.equal(isValidOutline(normaliseCorners(moved)), true);
  });
});

describe("dragging a corner", () => {
  it("moves an L's inner foot corner, both of its sides along x and z", () => {
    assert.deepEqual(normaliseCorners(moveCorner(L_SHAPE, 3, [650, 300])), [
      [0, 0],
      [850, 0],
      [850, 300],
      [650, 300],
      [650, 100],
      [0, 100],
    ]);
  });

  it("moves the first corner, sliding the last and the second with it", () => {
    assert.deepEqual(normaliseCorners(moveCorner(L_SHAPE, 0, [-50, -25])), [
      [-50, -25],
      [850, -25],
      [850, 250],
      [700, 250],
      [700, 100],
      [-50, 100],
    ]);
  });

  it("drags a rectangle's corner out, keeping it a rectangle", () => {
    assert.deepEqual(normaliseCorners(moveCorner(rectangleCorners([0, 0], 400, 300), 2, [500, 350])), rectangleCorners([0, 0], 500, 350));
  });

  it("moves a corner where the outline runs straight on, through a step", () => {
    const jointed: Corner[] = [
      [0, 0],
      [400, 0],
      [800, 0],
      [800, 200],
      [0, 200],
    ];
    const moved = normaliseCorners(moveCorner(jointed, 1, [400, -100]));
    assert.equal(isValidOutline(moved), true);
    assert.ok(moved.some(([x, z]) => x === 400 && z === -100));
  });
});

describe("a drag stops at the last valid outline", () => {
  it("takes the pointer's place when the outline there is valid", () => {
    const { corners, reached } = dragGrip(L_SHAPE, { kind: "side", index: 1 }, [850, 0], [1000, 40], 25);
    assert.deepEqual(reached, [1000, 40]);
    assert.deepEqual(corners, moveSide(L_SHAPE, 1, 1000));
  });

  it("stops a step short of folding the leg back over the outer side", () => {
    const { corners, reached } = dragGrip(L_SHAPE, { kind: "side", index: 3 }, [700, 250], [950, 250], 25);
    assert.equal(reached[0], 825);
    assert.deepEqual(corners, moveSide(L_SHAPE, 3, 825));
  });

  it("closes an L into a rectangle when its foot meets the long side, and stops there", () => {
    const flush = dragGrip(L_SHAPE, { kind: "side", index: 2 }, [850, 250], [850, 100], 25);
    assert.deepEqual(flush.corners, rectangleCorners([0, 0], 850, 100));
    const past = dragGrip(L_SHAPE, { kind: "side", index: 2 }, [850, 250], [850, 40], 25);
    assert.equal(past.reached[1], 100);
    assert.deepEqual(past.corners, rectangleCorners([0, 0], 850, 100));
    // and, in the same drag, back out again
    const back = dragGrip(L_SHAPE, { kind: "side", index: 2 }, flush.reached, [850, 250], 25);
    assert.deepEqual(back.corners, L_SHAPE);
  });

  it("keeps every side at least 10 mm, on the fine grid too", () => {
    const square = rectangleCorners([0, 0], 100, 100);
    assert.equal(dragGrip(square, { kind: "side", index: 1 }, [100, 0], [-60, 0], 25).reached[0], 25);
    assert.equal(dragGrip(square, { kind: "side", index: 1 }, [100, 0], [-60, 0], 5).reached[0], 10);
  });

  it("holds a corner on each axis on its own, so it slides along a limit", () => {
    // x past the foot's far side would fold the leg; z is free
    const { reached, corners } = dragGrip(L_SHAPE, { kind: "corner", index: 3 }, [700, 250], [900, 400], 25);
    assert.deepEqual(reached, [825, 400]);
    assert.equal(isValidOutline(corners), true);
  });

  it("never grows past 5000 mm overall", () => {
    const wide = rectangleCorners([-2000, 0], 4900, 100);
    assert.equal(dragGrip(wide, { kind: "side", index: 1 }, [2900, 0], [3400, 0], 25).reached[0], 3000);
  });

  it("stays on the table", () => {
    const { reached } = dragGrip(L_SHAPE, { kind: "side", index: 5 }, [0, 0], [-9000, 0], 25);
    assert.equal(reached[0] >= -TABLE_GUARD_MM, true);
  });
});
