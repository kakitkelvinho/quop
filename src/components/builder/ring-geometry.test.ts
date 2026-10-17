import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FAN_BAND, QUARTER, fanRing, polar, quarterSpan, wedge } from "./ring-geometry.ts";

// #255: the Tabletop menu opens a quarter fan from the workspace's corner, its
// hole clearing the file island and its band shrinking to fit a narrow screen.

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("ring geometry", () => {
  it("measures angles from the right, turning down the screen", () => {
    const [x0, y0] = polar(10, 0);
    const [x1, y1] = polar(10, QUARTER);
    assert.ok(close(x0, 10) && close(y0, 0));
    assert.ok(close(x1, 0) && close(y1, 10));
  });

  it("splits the quarter into equal wedges from the top edge to the left edge", () => {
    const spans = [0, 1, 2, 3].map((i) => quarterSpan(i, 4));
    assert.equal(spans[0].a0, 0);
    assert.ok(close(spans[3].a1, QUARTER));
    for (const [i, span] of spans.entries()) {
      assert.ok(close(span.a1 - span.a0, QUARTER / 4));
      if (i > 0) assert.ok(close(span.a0, spans[i - 1].a1));
    }
  });

  it("draws a closed wedge between two radii", () => {
    const d = wedge(50, 100, 0, QUARTER);
    assert.match(d, /^M100 0A100 100 0 0 1 /);
    assert.match(d, /A50 50 0 0 0 50 0Z$/);
  });
});

describe("the file fan's ring", () => {
  it("clears the island and takes its full band when there is room", () => {
    const ring = fanRing(220, 1000);
    assert.equal(ring.inner, 220);
    assert.equal(ring.band, FAN_BAND.full);
    assert.equal(ring.outer, 220 + FAN_BAND.full);
    assert.equal(ring.hints, true);
  });

  it("thins to fit the room, and drops the hints when it is thin", () => {
    const ring = fanRing(260, 352);
    assert.equal(ring.outer, 352);
    assert.equal(ring.hints, false);
  });

  it("never thins past its floor, nor lets the hole shrink over the island", () => {
    const ring = fanRing(260, 280);
    assert.equal(ring.inner, 260);
    assert.equal(ring.band, FAN_BAND.least);
  });
});
