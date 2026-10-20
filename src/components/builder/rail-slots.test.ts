import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { finishGroupMode, groupModeHints, groupSlotLabel } from "./group-mode.ts";
import { bringPanelToFront, panelState, resetPanels, setPanelView } from "./panel-store.ts";
import { railSlotAction, railSlotLabel, railSlotLook, toggleListPanel, type RailSlotState } from "./rail-slots.ts";

// #260: the panel rail's slots are always there; an empty one creates, and
// pressed again stops what it started. Groups starts a picking mode.

const slot = (patch: Partial<RailSlotState> = {}): RailSlotState => ({
  count: 0,
  shown: false,
  live: false,
  canCreate: true,
  ...patch,
});

describe("a rail slot", () => {
  it("with items shows or hides its list, whatever is live", () => {
    assert.equal(railSlotAction(slot({ count: 3, shown: true })), "toggle");
    assert.equal(railSlotAction(slot({ count: 3, shown: false })), "toggle");
    assert.equal(railSlotAction(slot({ count: 1, live: true })), "toggle");
  });

  it("empty, starts the first one", () => {
    assert.equal(railSlotAction(slot()), "create");
  });

  it("empty and live, stops what it started", () => {
    assert.equal(railSlotAction(slot({ live: true })), "stop");
    // even when it couldn't start again now
    assert.equal(railSlotAction(slot({ live: true, canCreate: false })), "stop");
  });

  it("empty and unable to start, does nothing and says so", () => {
    assert.equal(railSlotAction(slot({ canCreate: false })), "none");
    assert.equal(railSlotLook(slot({ canCreate: false })).disabled, true);
  });

  it("shows a count, or a + while empty", () => {
    assert.equal(railSlotLook(slot({ count: 4 })).badge, "4");
    assert.equal(railSlotLook(slot()).badge, "+");
    assert.equal(railSlotLook(slot()).empty, true);
  });

  it("shows pressed while its list shows, and lights only while its mode is live", () => {
    assert.equal(railSlotLook(slot({ count: 2, shown: true })).shown, true);
    assert.equal(railSlotLook(slot({ count: 2, shown: true })).active, false);
    assert.equal(railSlotLook(slot({ count: 2, shown: false })).shown, false);
    assert.equal(railSlotLook(slot({ live: true })).active, true);
    assert.equal(railSlotLook(slot()).active, false);
  });

  it("names its list, or the action an empty one takes", () => {
    const create = { start: "Draw a beam", stop: "Stop drawing the beam" };
    assert.equal(railSlotLabel("Beams", slot({ count: 2 }), create), "Beams (2)");
    assert.equal(railSlotLabel("Beams", slot(), create), "Draw a beam");
    assert.equal(railSlotLabel("Beams", slot({ live: true }), create), "Stop drawing the beam");
  });
});

describe("a slot with items, where panels move", () => {
  beforeEach(() => resetPanels());

  it("minimises its list, and brings it back in front", () => {
    bringPanelToFront("frames");
    toggleListPanel("beams");
    assert.equal(panelState("beams").minimised, true);
    toggleListPanel("beams");
    assert.equal(panelState("beams").minimised, undefined);
    assert.ok((panelState("beams").z ?? 0) > (panelState("frames").z ?? 0));
  });

  it("restores a list minimised from its own bar", () => {
    setPanelView("groups", "minimised");
    toggleListPanel("groups");
    assert.equal(panelState("groups").minimised, undefined);
  });
});

describe("group mode", () => {
  it("groups two or more picked parts, and otherwise just stops", () => {
    assert.equal(finishGroupMode(0), "stop");
    assert.equal(finishGroupMode(1), "stop");
    assert.equal(finishGroupMode(2), "group");
    assert.equal(finishGroupMode(7), "group");
  });

  it("names in its badge how many Enter would group", () => {
    assert.deepEqual(groupModeHints(3), [
      ["⌘ click", "pick"],
      ["⌘ drag", "box"],
      ["Enter", "group 3"],
      ["Esc", "cancel"],
    ]);
    assert.deepEqual(groupModeHints(1)[2], ["Enter", "group"]);
  });

  it("gives the badge's hints distinct keys", () => {
    const keys = groupModeHints(2).map(([key]) => key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("names what the Groups slot does when pressed again", () => {
    assert.equal(groupSlotLabel(2), "Group the 2 picked parts");
    assert.equal(groupSlotLabel(1), "Stop grouping");
  });
});
