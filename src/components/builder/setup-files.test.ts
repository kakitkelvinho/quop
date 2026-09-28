import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseScene, serializeScene } from "./types.ts";

// ADR 0001: a setup file saved by a release keeps opening, with nothing
// dropped, in every later release. Each fixture is a setup file in the shape
// one schema version saved; see setup-fixtures/README.md before touching them.

const FIXTURES = ["setup-v1.json", "setup-v2.json"];

/** Older files name beam splitters these ways; they open as beam splitters. */
const LEGACY_NAMES: Record<string, string> = {
  beamsplitter: "beam-splitter",
  "pbs-cube": "beam-splitter",
};

type SavedSetup = {
  components: { id: string; type: string }[];
  beams: { id: string; path: string[] }[];
};

function readSaved(name: string): SavedSetup {
  return JSON.parse(readFileSync(new URL(`./setup-fixtures/${name}`, import.meta.url), "utf8"));
}

function open(name: string) {
  const setup = parseScene(readSaved(name));
  assert.ok(setup, `${name} should open`);
  return setup;
}

for (const name of FIXTURES) {
  describe(name, () => {
    const saved = readSaved(name);

    it("opens with every component it was saved with", () => {
      assert.deepEqual(
        open(name).components.map(({ id, type }) => ({ id, type })),
        saved.components.map(({ id, type }) => ({ id, type: LEGACY_NAMES[type] ?? type })),
      );
    });

    it("opens with every beam and its full path", () => {
      assert.deepEqual(
        open(name).beams.map(({ id, path }) => ({ id, path })),
        saved.beams.map(({ id, path }) => ({ id, path })),
      );
    });

    it("keeps a trapped particle in its trap", () => {
      assert.equal(open(name).components.find(({ id }) => id === "ion")?.host, "trap");
    });

    it("gives the same setup when saved and opened again", () => {
      const setup = open(name);
      assert.deepEqual(parseScene(JSON.parse(serializeScene(setup))), setup);
    });
  });
}

describe("setup-v2.json, the first version with heights", () => {
  it("keeps each component at the height it was saved at", () => {
    assert.equal(open("setup-v2.json").components.find(({ id }) => id === "cam")?.position[1], 125);
  });
});
