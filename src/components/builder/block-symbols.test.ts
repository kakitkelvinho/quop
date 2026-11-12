import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { BLOCK_SYMBOLS, blockSize, newComponent, parseScene, serializeScene } from "./types.ts";

const fixture = JSON.parse(readFileSync(new URL("./setup-fixtures/setup-v14.json", import.meta.url), "utf8"));

describe("symbol blocks in setup files", () => {
  it("loads every symbol with its tile size, and round-trips its field", () => {
    const scene = parseScene(fixture);
    assert.ok(scene);
    const blocks = scene.components.filter((part) => part.type === "block");
    assert.deepEqual(new Set(blocks.map((part) => part.symbol)), new Set(BLOCK_SYMBOLS));
    for (const block of blocks) {
      assert.deepEqual(blockSize(block), block.symbol === "scope" ? [200, 120, 120] : [60, 30, 60]);
    }
    assert.deepEqual(parseScene(JSON.parse(serializeScene(scene))), scene);
  });

  it("drops an unknown symbol but keeps a plain block", () => {
    const scene = parseScene({ version: 14, components: [{ id: "box", type: "block", position: [0, 15, 0], rotation: 0, symbol: "quantum-widget" }] });
    assert.ok(scene);
    assert.equal(scene.components.length, 1);
    assert.equal(scene.components[0].symbol, undefined);
    assert.deepEqual(blockSize(scene.components[0]), [30, 30, 30]);
    assert.ok(!serializeScene(scene).includes("symbol"));
  });

  it("opens v13 plain blocks without changing their size, colour or position", () => {
    const raw = { version: 13, components: [{ id: "box", type: "block", position: [12, 25, 34], rotation: 30, size: [100, 50, 60], color: "#3b4a6b" }] };
    const part = parseScene(raw)?.components[0];
    assert.ok(part);
    assert.deepEqual(part.position, raw.components[0].position);
    assert.deepEqual(part.size, raw.components[0].size);
    assert.equal(part.color, raw.components[0].color);
    assert.equal(part.symbol, undefined);
  });

  it("places a symbol palette block on the table", () => {
    const tile = newComponent("block", "tile", 0, 0, { symbol: "mixer" });
    const scope = newComponent("block", "scope", 0, 0, { symbol: "scope" });
    assert.deepEqual([tile.position[1], tile.size, tile.color], [15, [60, 30, 60], undefined]);
    assert.deepEqual([scope.position[1], scope.size], [60, [200, 120, 120]]);
  });
});
