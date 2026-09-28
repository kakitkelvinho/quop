import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseScene, serializeScene } from "./types.ts";

// ADR 0001: a setup file saved by a release keeps opening, with nothing
// dropped, in every later release. Each fixture is a setup file as saved by
// one schema version; see setup-fixtures/README.md before touching them.

type SavedSetup = {
  components: { id: string; type: string; host?: string }[];
  beams: { id: string; path: string[] }[];
};

function readFixture(name: string): SavedSetup {
  return JSON.parse(readFileSync(new URL(`./setup-fixtures/${name}`, import.meta.url), "utf8"));
}

function openFixture(name: string) {
  const setup = parseScene(readFixture(name));
  assert.ok(setup, `${name} should open`);
  return setup;
}

describe("a v1 setup file", () => {
  const saved = readFixture("setup-v1.json");

  it("opens with every component, old beam splitter names read as beam splitters", () => {
    const setup = openFixture("setup-v1.json");
    const legacy: Record<string, string> = { beamsplitter: "beam-splitter", "pbs-cube": "beam-splitter" };
    assert.deepEqual(
      setup.components.map(({ id, type }) => ({ id, type })),
      saved.components.map(({ id, type }) => ({ id, type: legacy[type] ?? type })),
    );
  });

  it("opens with every beam and its full path", () => {
    const setup = openFixture("setup-v1.json");
    assert.deepEqual(
      setup.beams.map(({ id, path }) => ({ id, path })),
      saved.beams.map(({ id, path }) => ({ id, path })),
    );
  });

  it("stands its components at the beam height, since v1 had no heights", () => {
    const setup = openFixture("setup-v1.json");
    const mirror = setup.components.find(({ id }) => id === "m1");
    assert.equal(mirror?.position[1], 100);
  });

  it("keeps a trapped particle in its trap", () => {
    const setup = openFixture("setup-v1.json");
    assert.equal(setup.components.find(({ id }) => id === "ion")?.host, "trap");
  });
});

describe("a v2 setup file", () => {
  const saved = readFixture("setup-v2.json");

  it("opens with every component it was saved with", () => {
    const setup = openFixture("setup-v2.json");
    assert.deepEqual(
      setup.components.map(({ id, type }) => ({ id, type })),
      saved.components.map(({ id, type }) => ({ id, type })),
    );
  });

  it("opens with every beam and its full path", () => {
    const setup = openFixture("setup-v2.json");
    assert.deepEqual(
      setup.beams.map(({ id, path }) => ({ id, path })),
      saved.beams.map(({ id, path }) => ({ id, path })),
    );
  });

  it("keeps each component at the height it was saved at", () => {
    const setup = openFixture("setup-v2.json");
    assert.equal(setup.components.find(({ id }) => id === "cam")?.position[1], 125);
  });

  it("keeps a trapped particle in its trap", () => {
    const setup = openFixture("setup-v2.json");
    assert.equal(setup.components.find(({ id }) => id === "ion")?.host, "trap");
  });
});

describe("saving an opened setup file and opening it again", () => {
  for (const name of ["setup-v1.json", "setup-v2.json"]) {
    it(`gives the same setup for ${name}`, () => {
      const setup = openFixture(name);
      assert.deepEqual(parseScene(JSON.parse(serializeScene(setup))), setup);
    });
  }
});
