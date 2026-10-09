import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseScene, serializeScene } from "./types.ts";

// #107: the single-photon detector and the time tagger are new types, not a
// new schema, so a version-2 file holding them opens and saves unchanged.

const saved = {
  version: 2,
  components: [
    { id: "laser", type: "laser-source", position: [-300, 100, 0], rotation: 0 },
    { id: "spcm-a", type: "single-photon-detector", position: [0, 100, 0], rotation: 30, label: "SPCM A" },
    { id: "tagger", type: "time-tagger", position: [300, 100, 0], rotation: 180 },
  ],
  beams: [{ id: "beam", path: ["laser", "spcm-a"], color: "#dc2626" }],
};

function open() {
  const setup = parseScene(saved);
  assert.ok(setup, "the setup should open");
  return setup;
}

describe("a setup with a single-photon detector and a time tagger", () => {
  it("opens with both parts", () => {
    assert.deepEqual(
      open().components.map(({ id, type }) => ({ id, type })),
      [
        { id: "laser", type: "laser-source" },
        { id: "spcm-a", type: "single-photon-detector" },
        { id: "tagger", type: "time-tagger" },
      ],
    );
  });

  it("keeps the detector's height and label, and turns it to the laser", () => {
    const spcm = open().components.find(({ id }) => id === "spcm-a");
    assert.deepEqual([spcm?.position, spcm?.label, spcm?.rotation], [[0, 100, 0], "SPCM A", 0]);
  });

  it("stands the time tagger at its fixed height, whatever the file says", () => {
    assert.deepEqual(open().components.find(({ id }) => id === "tagger")?.position, [300, 27, 0]);
  });

  it("gives the same setup when saved and opened again", () => {
    const setup = open();
    assert.deepEqual(parseScene(JSON.parse(serializeScene(setup))), setup);
  });
});
