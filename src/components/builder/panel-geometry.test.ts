import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PANEL_BAR_PX, PANEL_KEEP_PX, clampPanel, movePanel, wholeRect } from "./panel-geometry.ts";

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
