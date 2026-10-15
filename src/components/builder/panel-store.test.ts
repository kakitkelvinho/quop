import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  bringPanelToFront,
  keepPanelsInside,
  movePanelTo,
  panelState,
  panelsVersion,
  resetPanels,
  setPanelView,
  subscribePanels,
  workspaceBounds,
} from "./panel-store.ts";

const rect = { x: 1100, y: 100, w: 264, h: 400 };

describe("the panels", () => {
  beforeEach(() => resetPanels());

  it("start where the CSS puts them", () => {
    assert.deepEqual(panelState("inspector"), {});
  });

  it("bring the one last pressed to the front", () => {
    bringPanelToFront("beams");
    bringPanelToFront("inspector");
    assert.ok(panelState("inspector").z! > panelState("beams").z!);
    bringPanelToFront("beams");
    assert.ok(panelState("beams").z! > panelState("inspector").z!);
  });

  it("don't change when the front one is pressed again", () => {
    bringPanelToFront("parts");
    const version = panelsVersion();
    bringPanelToFront("parts");
    assert.equal(panelsVersion(), version);
  });

  it("keep a moved panel's place and its place in the stack", () => {
    bringPanelToFront("parts");
    const { z } = panelState("parts");
    movePanelTo("parts", rect);
    assert.deepEqual(panelState("parts"), { rect, z });
  });

  it("slide moved panels back in when the workspace shrinks, and leave the rest", () => {
    movePanelTo("inspector", rect);
    movePanelTo("beams", { ...rect, x: 20 });
    keepPanelsInside({ width: 900, height: 733 });
    assert.equal(panelState("inspector").rect?.x, 810);
    assert.equal(panelState("beams").rect?.x, 20);
    assert.deepEqual(panelState("frames"), {});
  });

  it("all go back where they start on reset", () => {
    movePanelTo("inspector", rect);
    bringPanelToFront("beams");
    resetPanels();
    assert.deepEqual([panelState("inspector"), panelState("beams")], [{}, {}]);
  });

  it("tell their listeners", () => {
    let heard = 0;
    const stop = subscribePanels(() => (heard += 1));
    movePanelTo("json", rect);
    resetPanels();
    stop();
    movePanelTo("json", rect);
    assert.equal(heard, 2);
  });

  it("minimise and maximise, each undoing the other, and restore", () => {
    movePanelTo("beams", rect);
    setPanelView("beams", "minimised");
    assert.deepEqual(panelState("beams"), { rect, minimised: true });
    setPanelView("beams", "maximised");
    assert.deepEqual(panelState("beams"), { rect, maximised: true });
    setPanelView("beams", "restored");
    assert.deepEqual(panelState("beams"), { rect });
  });

  it("don't change when a panel is put in the state it is in", () => {
    setPanelView("parts", "minimised");
    const version = panelsVersion();
    setPanelView("parts", "minimised");
    setPanelView("groups", "restored");
    assert.equal(panelsVersion(), version);
  });

  it("all open again on reset", () => {
    setPanelView("inspector", "minimised");
    setPanelView("json", "maximised");
    resetPanels();
    assert.deepEqual([panelState("inspector"), panelState("json")], [{}, {}]);
  });

  it("know the workspace's size, and tell a maximised panel when it changes", () => {
    keepPanelsInside({ width: 1287, height: 733 });
    let heard = 0;
    const stop = subscribePanels(() => (heard += 1));
    keepPanelsInside({ width: 1287, height: 733 });
    keepPanelsInside({ width: 1000, height: 733 });
    stop();
    assert.deepEqual([heard, workspaceBounds()], [1, { width: 1000, height: 733 }]);
  });
});
