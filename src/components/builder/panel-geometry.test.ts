import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PANEL_BAR_PX,
  PANEL_GAP_PX,
  PANEL_INSET_PX,
  PANEL_KEEP_PX,
  PANEL_SNAP_PX,
  PANEL_MAX_BOTTOM_PX,
  PANEL_MAX_TOP_PX,
  PANEL_MIN_H,
  PANEL_MIN_W,
  clampPanel,
  maximisedRect,
  movePanel,
  resizePanel,
  snapPanel,
  wholeRect,
} from "./panel-geometry.ts";

const workspace = { width: 1287, height: 733 };
const panel = { x: 100, y: 100, w: 264, h: 400 };

describe("a panel's rect", () => {
  it("is whole pixels", () => {
    assert.deepEqual(wholeRect({ x: 14.4, y: 116.8, w: 321.75, h: 512.5 }), { x: 14, y: 117, w: 322, h: 513 });
  });
});

describe("keeping a panel in reach", () => {
  it("leaves a panel inside the workspace where it is", () => {
    assert.deepEqual(clampPanel(panel, workspace), panel);
  });

  it("keeps 90 px of its bar inside on the right", () => {
    assert.equal(clampPanel({ ...panel, x: 5000 }, workspace).x, workspace.width - PANEL_KEEP_PX);
  });

  it("keeps 90 px of its bar inside on the left", () => {
    assert.equal(clampPanel({ ...panel, x: -5000 }, workspace).x, PANEL_KEEP_PX - panel.w);
  });

  it("keeps its whole bar inside top to bottom", () => {
    assert.equal(clampPanel({ ...panel, y: -40 }, workspace).y, 0);
    assert.equal(clampPanel({ ...panel, y: 5000 }, workspace).y, workspace.height - PANEL_BAR_PX);
  });

  it("lets the rest of the panel hang off an edge", () => {
    assert.deepEqual(clampPanel({ ...panel, x: 1100, y: 600 }, workspace), { ...panel, x: 1100, y: 600 });
  });

  it("slides back in when the workspace shrinks", () => {
    const moved = { ...panel, x: 1150 };
    assert.equal(clampPanel(moved, { width: 900, height: 733 }).x, 900 - PANEL_KEEP_PX);
  });

  it("keeps all of a panel narrower than 90 px", () => {
    assert.equal(clampPanel({ ...panel, w: 60, x: -100 }, workspace).x, 0);
  });

  it("lands on whole pixels against a workspace of fractional size", () => {
    const rect = clampPanel({ ...panel, x: 9999, y: 9999 }, { width: 1000.6, height: 700.4 });
    assert.deepEqual([rect.x, rect.y], [910, 670]);
  });
});

describe("dragging a panel by its bar", () => {
  it("moves it by the pointer, in whole pixels", () => {
    assert.deepEqual(movePanel(panel, 20.4, -10.6, workspace), { ...panel, x: 120, y: 89 });
  });

  it("stops where its bar would leave the workspace", () => {
    assert.deepEqual(movePanel(panel, -2000, -2000, workspace), { ...panel, x: PANEL_KEEP_PX - panel.w, y: 0 });
  });
});

describe("snapping a dragged panel", () => {
  // a panel well inside the workspace, and another to snap against
  const free = { x: 400, y: 300, w: 200, h: 150 };
  const other = { x: 700, y: 100, w: 260, h: 300 };
  const snap = (rect: Partial<typeof free>, others = [other]) => snapPanel({ ...free, ...rect }, others, workspace);

  it("snaps to the workspace's left and top edges, inset", () => {
    assert.deepEqual(snap({ x: 20, y: 5 }), { ...free, x: PANEL_INSET_PX, y: PANEL_INSET_PX });
  });

  it("snaps its right and bottom edges to the workspace's, inset", () => {
    const right = workspace.width - PANEL_INSET_PX - free.w;
    const bottom = workspace.height - PANEL_INSET_PX - free.h;
    assert.deepEqual(snap({ x: right - 7, y: bottom + 9 }, []), { ...free, x: right, y: bottom });
  });

  it("snaps beside another panel with the gap, on either side", () => {
    assert.equal(snap({ x: other.x + other.w + PANEL_GAP_PX + 6 }).x, other.x + other.w + PANEL_GAP_PX);
    assert.equal(snap({ x: other.x - free.w - PANEL_GAP_PX - 4 }).x, other.x - free.w - PANEL_GAP_PX);
  });

  it("snaps above and below another panel with the gap", () => {
    assert.equal(snap({ y: other.y + other.h + PANEL_GAP_PX - 3 }).y, other.y + other.h + PANEL_GAP_PX);
    assert.equal(snap({ y: other.y - free.h - PANEL_GAP_PX + 2 }).y, other.y - free.h - PANEL_GAP_PX);
  });

  it("lines up with either edge of another panel", () => {
    assert.equal(snap({ x: other.x + 5 }).x, other.x);
    assert.equal(snap({ x: other.x + other.w - free.w - 5 }).x, other.x + other.w - free.w);
    assert.equal(snap({ y: other.y - 8 }).y, other.y);
  });

  it("snaps at the threshold and not beyond it", () => {
    assert.equal(snap({ x: PANEL_INSET_PX + PANEL_SNAP_PX }).x, PANEL_INSET_PX);
    assert.equal(snap({ x: PANEL_INSET_PX + PANEL_SNAP_PX + 1 }).x, PANEL_INSET_PX + PANEL_SNAP_PX + 1);
  });

  it("takes the nearest of several", () => {
    // the other panel's left edge is 3 px off, the gap beside a second 6 px off
    const second = { x: 100, y: 600, w: 586, h: 50 };
    assert.equal(snap({ x: other.x + 3 }, [second, other]).x, other.x);
  });

  it("snaps each axis on its own", () => {
    assert.deepEqual(snap({ x: other.x + 4, y: 300 }), { ...free, x: other.x, y: 300 });
    assert.deepEqual(snap({ x: 400, y: other.y + 4 }), { ...free, x: 400, y: other.y });
  });

  it("snaps against every other panel", () => {
    const third = { x: 50, y: 500, w: 150, h: 100 };
    assert.equal(snap({ x: 50 + 150 + PANEL_GAP_PX + 2 }, [other, third]).x, 50 + 150 + PANEL_GAP_PX);
  });
});

describe("dragging a panel near others", () => {
  it("snaps as it moves", () => {
    const others = [{ x: 600, y: 100, w: 200, h: 200 }];
    assert.equal(movePanel(panel, 600 + 200 + PANEL_GAP_PX - panel.x - 5, 0, workspace, others).x, 808);
  });

  it("still keeps its bar in reach when a snap target lies outside", () => {
    // a panel hanging off the left edge: lining up with its left edge would lose the bar
    const others = [{ x: -400, y: 100, w: 500, h: 200 }];
    const moved = movePanel(panel, -400 - panel.x + 3, 0, workspace, others);
    assert.equal(moved.x, PANEL_KEEP_PX - panel.w);
  });
});

describe("a maximised panel", () => {
  it("fills the workspace below the toolbars, inset at the sides", () => {
    assert.deepEqual(maximisedRect(workspace), {
      x: PANEL_INSET_PX,
      y: PANEL_MAX_TOP_PX,
      w: workspace.width - 2 * PANEL_INSET_PX,
      h: workspace.height - PANEL_MAX_TOP_PX - PANEL_MAX_BOTTOM_PX,
    });
  });

  it("is whole pixels in a workspace of fractional size", () => {
    const { w, h } = maximisedRect({ width: 1000.6, height: 700.4 });
    assert.deepEqual([w, h], [977, 522]);
  });

  it("keeps its bar in a tiny workspace", () => {
    const { w, h } = maximisedRect({ width: 50, height: 100 });
    assert.deepEqual([w, h], [PANEL_KEEP_PX, PANEL_BAR_PX]);
  });
});

describe("resizing a panel", () => {
  it("moves only the edge it is dragged by, and keeps its top-left corner", () => {
    assert.deepEqual(resizePanel(panel, "e", 40, 70, workspace), { ...panel, w: 304 });
    assert.deepEqual(resizePanel(panel, "s", 40, 70, workspace), { ...panel, h: 470 });
    assert.deepEqual(resizePanel(panel, "se", 40, 70, workspace), { ...panel, w: 304, h: 470 });
  });

  it("never goes below the minimum size", () => {
    assert.deepEqual(resizePanel(panel, "se", -1000, -1000, workspace), { ...panel, w: PANEL_MIN_W, h: PANEL_MIN_H });
  });

  it("stops at the workspace's right and bottom edges", () => {
    const { w, h } = resizePanel(panel, "se", 5000, 5000, workspace);
    assert.deepEqual([w, h], [workspace.width - panel.x, workspace.height - panel.y]);
  });

  it("keeps the minimum where the workspace leaves less room", () => {
    const near = { ...panel, x: 1200, y: 700 };
    const { w, h } = resizePanel(near, "se", 0, 0, workspace);
    assert.deepEqual([w, h], [PANEL_MIN_W, PANEL_MIN_H]);
  });

  it("is whole pixels", () => {
    assert.deepEqual(resizePanel(panel, "se", 10.4, 10.6, workspace), { ...panel, w: 274, h: 411 });
  });

  it("still keeps the bar in reach", () => {
    // a panel hanging off the left edge, made narrower: it slides in to keep 90 px of its bar
    const hanging = { ...panel, x: PANEL_KEEP_PX - panel.w };
    const resized = resizePanel(hanging, "e", -60, 0, workspace);
    assert.deepEqual([resized.w, resized.x], [204, PANEL_KEEP_PX - 204]);
  });
});
