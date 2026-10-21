import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import LZString from "lz-string";

import { hashToScene, hasWork, isShareHash, sceneToHash } from "./share-link.ts";
import { DEFAULT_SCENE, EMPTY_SCENE, parseScene, serializeScene } from "./types.ts";

/** The latest fixture: parts, beams, connections, frames, groups and a label scale. */
const SETUP = parseScene(
  JSON.parse(readFileSync(new URL("./setup-fixtures/setup-v13.json", import.meta.url), "utf8")),
)!;

describe("share links", () => {
  it("round-trips a setup exactly", () => {
    assert.ok(SETUP.beams.length && SETUP.frames.length && SETUP.groups.length && SETUP.labelScale);
    const hash = sceneToHash(SETUP);
    assert.match(hash, /^#s=[A-Za-z0-9+\-$]+$/);
    assert.deepEqual(hashToScene(hash), SETUP);
  });

  it("carries the minified setup file, version and all", () => {
    const text = LZString.decompressFromEncodedURIComponent(sceneToHash(SETUP).slice(3));
    assert.equal(text, serializeScene(SETUP, { minified: true }));
    assert.equal(JSON.parse(text).version, SETUP.version);
  });

  it("reads nothing from a hash without #s=", () => {
    assert.equal(hashToScene(""), null);
    assert.equal(hashToScene("#"), null);
    assert.equal(hashToScene("#s="), null);
    assert.equal(hashToScene(sceneToHash(SETUP).replace("#s=", "#t=")), null);
    assert.equal(isShareHash(""), false);
  });

  it("returns null for garbage", () => {
    assert.equal(hashToScene("#s=garbage!!"), null);
    assert.equal(hashToScene("#s=" + "x".repeat(500)), null);
    assert.ok(isShareHash("#s=garbage!!"));
    // a good blob of text that isn't a setup
    assert.equal(hashToScene(`#s=${LZString.compressToEncodedURIComponent("{not json")}`), null);
    assert.equal(hashToScene(`#s=${LZString.compressToEncodedURIComponent('{"beams":[]}')}`), null);
  });
});

describe("hasWork", () => {
  it("is false for an empty table or the untouched example", () => {
    assert.equal(hasWork(EMPTY_SCENE), false);
    assert.equal(hasWork(parseScene(JSON.parse(serializeScene(parseScene(DEFAULT_SCENE)!)))!), false);
  });

  it("is true for anything else", () => {
    assert.equal(hasWork(SETUP), true);
    const example = parseScene(DEFAULT_SCENE)!;
    assert.equal(hasWork({ ...example, components: example.components.slice(1) }), true);
  });
});
