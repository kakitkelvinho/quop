import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  bringPanelToFront,
  keepPanelsInside,
  movePanelTo,
  panelState,
  panelsVersion,
  resetPanels,
  subscribePanels,
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
});
