import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  minimiseAll,
  minimisedIn,
  minimisedPanels,
  partsSpotShowing,
  restoreLabel,
  restorePanel,
  selectionKey,
  selectionReopensInspector,
  showingPanels,
  tabletopPanels,
} from "./minimised-panels.ts";
import { bringPanelToFront, movePanelTo, panelState, resetPanels, setPanelView } from "./panel-store.ts";

const ids = (panels: { id: string }[]) => panels.map((panel) => panel.id);

/** Something selected, every list with rows, the parts panel closed and the JSON panel open. */
const busy = {
  inspector: { subtitle: "Mirror M3" },
  beams: 2,
  frames: 1,
  groups: 1,
  partsOpen: false,
  briefOpen: false,
  jsonOpen: true,
};

describe("the Tabletop's panels", () => {
  it("are on the page while they have something to show", () => {
    const panels = tabletopPanels(busy);
    assert.deepEqual(ids(panels.filter((panel) => panel.mounted)), ["inspector", "json", "beams", "frames", "groups"]);
    const empty = tabletopPanels({ ...busy, inspector: null, beams: 0, frames: 0, groups: 0, jsonOpen: false });
    assert.deepEqual(ids(empty.filter((panel) => panel.mounted)), []);
  });

  it("give the brief and the JSON panel up while the parts panel takes their spot", () => {
    const panels = tabletopPanels({ ...busy, partsOpen: true, briefOpen: true });
    const mounted = ids(panels.filter((panel) => panel.mounted));
    assert.ok(mounted.includes("parts"));
    assert.ok(!mounted.includes("brief"));
    assert.ok(!mounted.includes("json"));
  });

  it("carry what the Inspector holds", () => {
    assert.equal(tabletopPanels(busy)[0].subtitle, "Mirror M3");
  });
});

describe("the minimised column", () => {
  beforeEach(() => resetPanels());

  it("holds the minimised panels on the page, and only those", () => {
    setPanelView("inspector", "minimised");
    setPanelView("parts", "minimised"); // closed: no icon
    setPanelView("frames", "maximised");
    assert.deepEqual(ids(minimisedPanels(tabletopPanels(busy), minimisedIn(true))), ["inspector"]);
  });

  it("is empty where panels stay put, whatever was kept", () => {
    setPanelView("inspector", "minimised");
    setPanelView("beams", "minimised");
    assert.deepEqual(minimisedPanels(tabletopPanels(busy), minimisedIn(false)), []);
  });

  it("names a panel with what it holds", () => {
    assert.equal(restoreLabel({ title: "Inspector", subtitle: "Mirror M3" }), "Restore Inspector: Mirror M3");
    assert.equal(restoreLabel({ title: "Beams" }), "Restore Beams");
  });

  it("restores a panel where it was, in front", () => {
    const rect = { x: 300, y: 200, w: 260, h: 180 };
    movePanelTo("beams", rect);
    bringPanelToFront("inspector");
    setPanelView("beams", "minimised");
    restorePanel("beams");
    const state = panelState("beams");
    assert.equal(state.minimised, undefined);
    assert.deepEqual(state.rect, rect);
    assert.ok(state.z! > panelState("inspector").z!);
  });
});

describe("Minimise all", () => {
  beforeEach(() => resetPanels());

  it("minimises every panel showing, and no closed one", () => {
    setPanelView("beams", "minimised");
    setPanelView("frames", "maximised");
    const panels = tabletopPanels(busy);
    assert.deepEqual(ids(showingPanels(panels, minimisedIn(true))), ["inspector", "json", "frames", "groups"]);
    assert.equal(minimiseAll(panels, minimisedIn(true)), 4);
    for (const id of ["inspector", "json", "beams", "frames", "groups"]) assert.equal(panelState(id).minimised, true, id);
    assert.equal(panelState("frames").maximised, undefined);
    for (const id of ["parts", "brief"]) assert.equal(panelState(id).minimised, undefined, id);
  });

  it("has nothing to do when nothing is showing", () => {
    const panels = tabletopPanels(busy);
    minimiseAll(panels, minimisedIn(true));
    assert.deepEqual(showingPanels(panels, minimisedIn(true)), []);
    assert.equal(minimiseAll(panels, minimisedIn(true)), 0);
  });
});

describe("the lists stepping aside for the parts panel's spot", () => {
  beforeEach(() => resetPanels());
  const isMinimised = minimisedIn(true);

  it("do it for a parts, brief or JSON panel that is showing", () => {
    assert.equal(partsSpotShowing({ partsOpen: true, briefOpen: false, jsonOpen: false }, isMinimised), true);
    assert.equal(partsSpotShowing({ partsOpen: false, briefOpen: true, jsonOpen: false }, isMinimised), true);
    assert.equal(partsSpotShowing({ partsOpen: false, briefOpen: false, jsonOpen: true }, isMinimised), true);
    assert.equal(partsSpotShowing({ partsOpen: false, briefOpen: false, jsonOpen: false }, isMinimised), false);
  });

  it("don't leave a gap for a minimised one", () => {
    setPanelView("parts", "minimised");
    assert.equal(partsSpotShowing({ partsOpen: true, briefOpen: false, jsonOpen: false }, isMinimised), false);
    setPanelView("brief", "minimised");
    assert.equal(partsSpotShowing({ partsOpen: false, briefOpen: true, jsonOpen: false }, isMinimised), false);
    setPanelView("json", "minimised");
    assert.equal(partsSpotShowing({ partsOpen: false, briefOpen: false, jsonOpen: true }, isMinimised), false);
  });

  it("follow the parts panel while it is open: a brief minimised behind it doesn't count", () => {
    setPanelView("brief", "minimised");
    assert.equal(partsSpotShowing({ partsOpen: true, briefOpen: true, jsonOpen: false }, isMinimised), true);
    setPanelView("parts", "minimised");
    setPanelView("brief", "restored");
    assert.equal(partsSpotShowing({ partsOpen: true, briefOpen: true, jsonOpen: false }, isMinimised), false);
  });

  it("do it for a kept minimised panel where panels stay put", () => {
    setPanelView("parts", "minimised");
    assert.equal(partsSpotShowing({ partsOpen: true, briefOpen: false, jsonOpen: false }, minimisedIn(false)), true);
  });
});

describe("a minimised Inspector", () => {
  const nothing = { beamDraft: false, connectDraft: false, parts: [] };
  const key = (patch: Partial<Parameters<typeof selectionKey>[0]>) => selectionKey({ ...nothing, ...patch });

  it("opens again for a different part, beam, frame, connection or set of parts", () => {
    const keys = [
      key({ parts: ["m3"] }),
      key({ parts: ["m4"] }),
      key({ parts: ["m3", "m4"] }),
      key({ beam: "b1" }),
      key({ frame: "f1" }),
      key({ connection: "c1" }),
    ];
    assert.equal(new Set(keys).size, keys.length);
    keys.forEach((next, at) => {
      if (at) assert.equal(selectionReopensInspector(keys[at - 1], next), true);
    });
  });

  it("opens again when a beam or connection draft starts, but not as it goes on", () => {
    assert.equal(selectionReopensInspector(key({ parts: ["m3"] }), key({ beamDraft: true, parts: ["m3"] })), true);
    assert.equal(selectionReopensInspector("", key({ connectDraft: true })), true);
    assert.equal(selectionReopensInspector(key({ beamDraft: true }), key({ beamDraft: true })), false);
  });

  it("stays minimised when the same thing is selected again, in any order", () => {
    assert.equal(selectionReopensInspector(key({ parts: ["m3"] }), key({ parts: ["m3"] })), false);
    assert.equal(selectionReopensInspector(key({ parts: ["a", "b"] }), key({ parts: ["b", "a"] })), false);
  });

  it("stays minimised when the selection is cleared", () => {
    assert.equal(key({}), "");
    assert.equal(selectionReopensInspector(key({ beam: "b1" }), ""), false);
  });

  it("opens again for a selection after none", () => {
    assert.equal(selectionReopensInspector("", key({ frame: "f1" })), true);
  });

  it("follows the Inspector's own order: a draft over a selection, parts over a beam", () => {
    assert.equal(key({ beamDraft: true, parts: ["m3"], beam: "b1" }), "beam-draft");
    assert.equal(key({ parts: ["m3"], beam: "b1" }), key({ parts: ["m3"] }));
  });
});
