import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAN_BAND,
  PETAL_GAP,
  QUARTER,
  cornerClear,
  cornerSpan,
  fanArrows,
  fanRing,
  petalInset,
  polar,
  quarterSpan,
  wedge,
} from "./ring-geometry.ts";

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

describe("a corner fan's ring", () => {
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

// #260: four corner fans, each about 150 px deep, with petal gaps and no hints.
describe("a corner fan's depth", () => {
  it("takes the depth it asks for when there is room", () => {
    const ring = fanRing(180, 1000, 120, false);
    assert.equal(ring.band, 120);
    assert.equal(ring.outer, 300);
    assert.equal(ring.hints, false);
  });

  it("is 150 px deep by default", () => {
    assert.equal(FAN_BAND.full, 150);
    assert.equal(fanRing(100, 1000).band, 150);
  });

  it("thins to the room on a narrow screen, down to the floor and no further", () => {
    assert.equal(fanRing(200, 300, 150, false).band, 100);
    assert.equal(fanRing(200, 230, 150, false).band, FAN_BAND.least);
  });

  it("never shows hints when the fan asks for none, however deep", () => {
    assert.equal(fanRing(100, 1000, 150, false).hints, false);
    assert.equal(fanRing(100, 1000, 150, true).hints, true);
  });
});

describe("petals", () => {
  it("part neighbours by twice the gap at the hole", () => {
    const inner = 200;
    const inset = petalInset(inner);
    const a = cornerSpan("tl", 0, 4, inset);
    const b = cornerSpan("tl", 1, 4, inset);
    // the arc between them, at the hole
    assert.ok(close((b.a0 - a.a1) * inner, 2 * PETAL_GAP));
    // and wider further out
    assert.ok((b.a0 - a.a1) * (inner + 150) > 2 * PETAL_GAP);
  });

  it("leave a wedge's middle where it was", () => {
    const plain = cornerSpan("br", 2, 3);
    const petal = cornerSpan("br", 2, 3, petalInset(120));
    assert.ok(close(plain.mid, petal.mid));
    assert.ok(petal.a1 - petal.a0 < plain.a1 - plain.a0);
  });

  it("have no inset with no hole", () => {
    assert.equal(petalInset(0), 0);
  });
});

describe("corners", () => {
  it("sweep each quarter from the horizontal edge to the vertical one", () => {
    const first = (corner: "tl" | "tr" | "br") => cornerSpan(corner, 0, 3);
    const last = (corner: "tl" | "tr" | "br") => cornerSpan(corner, 2, 3);
    // top left: along the top edge (pointing right), then down the left edge
    assert.ok(close(first("tl").a0, 0) && close(last("tl").a1, QUARTER));
    // top right: along the top edge (pointing left), then down the right edge
    assert.ok(close(first("tr").a1, Math.PI) && close(last("tr").a0, QUARTER));
    // bottom right: along the bottom edge (pointing left), then up the right edge
    assert.ok(close(first("br").a0, Math.PI) && close(last("br").a1, 1.5 * Math.PI));
    for (const corner of ["tl", "tr", "br"] as const) {
      for (let i = 0; i < 3; i++) {
        const span = cornerSpan(corner, i, 3);
        assert.ok(span.a0 < span.a1);
      }
    }
  });

  it("clear the farthest island in the corner, plus a gap", () => {
    const stage = { left: 0, top: 0, right: 1000, bottom: 800 };
    const file = { left: 14, top: 14, right: 110, bottom: 50 };
    const add = { left: 14, top: 66, right: 56, bottom: 102 };
    const clear = cornerClear("tl", stage, [file, add], 8);
    assert.ok(close(clear, Math.max(Math.hypot(110, 50), Math.hypot(56, 102)) + 8));
    // the QUOP and + fans measure the same two islands, so they share one ring
    assert.equal(cornerClear("tl", stage, [add, file], 8), clear);
  });

  it("measure from their own corner", () => {
    const stage = { left: 0, top: 0, right: 1000, bottom: 800 };
    const help = { left: 950, top: 14, right: 986, bottom: 50 };
    assert.ok(close(cornerClear("tr", stage, [help], 0), Math.hypot(50, 50)));
    const view = { left: 900, top: 750, right: 986, bottom: 786 };
    assert.ok(close(cornerClear("br", stage, [view], 0), Math.hypot(100, 50)));
  });

  it("walk forward with the arrows that point along the sweep", () => {
    assert.deepEqual(fanArrows("tl"), { next: ["ArrowDown", "ArrowLeft"], previous: ["ArrowUp", "ArrowRight"] });
    assert.deepEqual(fanArrows("tr"), { next: ["ArrowDown", "ArrowRight"], previous: ["ArrowUp", "ArrowLeft"] });
    assert.deepEqual(fanArrows("br"), { next: ["ArrowUp", "ArrowRight"], previous: ["ArrowDown", "ArrowLeft"] });
  });
});
