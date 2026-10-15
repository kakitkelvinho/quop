import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PANELS_STORAGE_KEY, parseSavedPanels, serializePanels } from "./panel-memory.ts";
import { type PanelState, movePanelTo, resetPanels, setPanelView } from "./panel-store.ts";
import { parseScene, serializeScene } from "./types.ts";

const rect = { x: 900, y: 120, w: 264, h: 400 };
const saved = (panels: unknown, version: unknown = 1) => JSON.stringify({ version, panels });

describe("the panels' saved arrangement", () => {
  it("is kept under one versioned key", () => {
    assert.equal(PANELS_STORAGE_KEY, "quop-builder-panels:v1");
  });

  it("comes back as it was saved", () => {
    const panels = new Map<string, PanelState>([
      ["inspector", { rect, minimised: true, z: 14 }],
      ["beams", { rect: { ...rect, x: 20 }, sized: true }],
      ["json", { rect, maximised: true }],
    ]);
    assert.deepEqual(
      parseSavedPanels(serializePanels(panels)),
      new Map<string, PanelState>([
        ["inspector", { rect, minimised: true }],
        ["beams", { rect: { ...rect, x: 20 }, sized: true }],
        ["json", { rect, maximised: true }],
      ]),
    );
  });

  it("is nothing when every panel is where it starts", () => {
    assert.equal(serializePanels(new Map([["parts", { z: 12 }]])), null);
  });

  it("is no arrangement when missing", () => {
    assert.equal(parseSavedPanels(null).size, 0);
  });

  it("is no arrangement from another version", () => {
    assert.equal(parseSavedPanels(saved({ parts: rect }, 2)).size, 0);
    assert.equal(parseSavedPanels(saved({ parts: rect }, "1")).size, 0);
  });

  it("is no arrangement when malformed", () => {
    for (const text of ["{", "null", "42", '"panels"', "[]", saved(null), saved([rect])]) {
      assert.equal(parseSavedPanels(text).size, 0, text);
    }
  });

  it("leaves out a panel this page doesn't have", () => {
    assert.deepEqual([...parseSavedPanels(saved({ toolbox: rect, parts: rect })).keys()], ["parts"]);
  });

  it("leaves out a place or size out of range, and keeps the rest", () => {
    const bad = [
      { ...rect, x: "900" },
      { ...rect, y: Number.MAX_VALUE },
      { ...rect, w: 0 },
      { ...rect, h: -40 },
      { x: 1, y: 2, w: 3 },
    ];
    for (const entry of bad) {
      assert.deepEqual([...parseSavedPanels(saved({ parts: entry, beams: rect })).keys()], ["beams"], JSON.stringify(entry));
    }
    // JSON has no Infinity: a value past the limit is what gets through
    assert.equal(parseSavedPanels(saved({ parts: { ...rect, x: 1e9 } })).size, 0);
  });

  it("rounds a saved place and size to whole pixels", () => {
    assert.deepEqual(parseSavedPanels(saved({ parts: { x: 14.4, y: 116.8, w: 321.75, h: 500.5 } })).get("parts"), {
      rect: { x: 14, y: 117, w: 322, h: 501 },
    });
  });

  it("takes only true for a flag, and one view at a time", () => {
    assert.deepEqual(parseSavedPanels(saved({ parts: { ...rect, minimised: "yes", sized: 1 } })).get("parts"), { rect });
    assert.deepEqual(parseSavedPanels(saved({ parts: { ...rect, minimised: true, maximised: true } })).get("parts"), {
      rect,
      minimised: true,
    });
  });
});

describe("a setup file", () => {
  it("is byte for byte the same however the panels are arranged", () => {
    const scene = parseScene({
      version: 12,
      components: [{ id: "spec", type: "spectrometer", position: [0, 150, 0], rotation: 0 }],
      beams: [],
    });
    assert.ok(scene);
    resetPanels();
    const before = serializeScene(scene);
    movePanelTo("inspector", rect);
    setPanelView("beams", "minimised");
    assert.equal(serializeScene(scene), before);
    assert.doesNotMatch(before, /panel/i);
    resetPanels();
  });
});
