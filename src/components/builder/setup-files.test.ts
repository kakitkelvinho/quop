import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { beamLengthMm, parseScene, serializeScene } from "./types.ts";

// ADR 0001: a setup file saved by a release keeps opening, with nothing
// dropped, in every later release. Each fixture is a setup file in the shape
// one schema version saved; see setup-fixtures/README.md before touching them.

const FIXTURES = ["setup-v1.json", "setup-v2.json", "setup-v3.json"];

/** Older files name beam cubes these ways; they open as beam cubes. */
const LEGACY_NAMES: Record<string, string> = {
  beamsplitter: "beam-splitter",
  "pbs-cube": "beam-splitter",
};

type SavedSetup = {
  components: { id: string; type: string }[];
  beams: { id: string; path: string[] }[];
  connections?: object[];
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

    it("opens with every connection it was saved with, or none before v3", () => {
      assert.deepEqual(open(name).connections, saved.connections ?? []);
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

describe("setup-v3.json, the first version with connections", () => {
  it("opens each fibre and cable with its ends, length and index, and older setups with none", () => {
    assert.deepEqual(
      open("setup-v3.json").connections.map(({ id, kind, from, to, lengthM }) => [id, kind, from, to, lengthM]),
      [
        ["fib-a", "fiber", "fiber", "pd", 2],
        ["coax-a", "cable", "pd", "tagger", undefined],
        ["coax-cam", "cable", "cam", "tagger", 1.5],
        ["fib-spare", "fiber", "fiber", "spec", undefined],
      ],
    );
    assert.equal(open("setup-v3.json").connections[0].refractiveIndex, 1.47);
    assert.equal(open("setup-v3.json").connections[2].velocityFactor, 0.7);
    assert.deepEqual(open("setup-v1.json").connections, []);
    assert.deepEqual(open("setup-v2.json").connections, []);
  });
});

describe("setup-v3.json, a laser with a built-in path", () => {
  it("opens with the path and counts it in its beam: 4000 mm inside plus 450 mm on the table", () => {
    const setup = open("setup-v3.json");
    assert.equal(setup.components.find(({ id }) => id === "laser-folded")?.internalPathMm, 4000);
    assert.equal(beamLengthMm(setup.components, setup.beams.find(({ id }) => id === "folded")!), 4450);
  });

  it("is on no laser in older setups", () => {
    for (const name of ["setup-v1.json", "setup-v2.json"]) {
      const lasers = open(name).components.filter(({ type }) => type === "laser-source");
      assert.ok(lasers.length > 0);
      assert.deepEqual(lasers.map(({ internalPathMm }) => internalPathMm), lasers.map(() => undefined));
    }
  });
});
