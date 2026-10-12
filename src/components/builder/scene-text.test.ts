import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCENE_LIMITS, SCENE_TEXT_MAX_BYTES, checkSceneText, errorPlace } from "./scene-text.ts";
import { DEFAULT_SCENE, LABEL_MAX_LENGTH, serializeScene } from "./types.ts";

// The JSON panel and Open file check a setup's text before it can replace the
// table: size, JSON, shape and counts, then what parseScene left out.

const MIRROR = { id: "m1", type: "mirror-mount", position: [0, 100, 0], rotation: 45 };

function setup(extra: Record<string, unknown> = {}) {
  return JSON.stringify({ version: 8, components: [MIRROR], ...extra });
}

describe("checking a setup's text", () => {
  it("reads a saved setup back whole", () => {
    const check = checkSceneText(serializeScene(DEFAULT_SCENE));
    assert.equal(check.ok, true);
    if (check.ok) {
      assert.equal(check.scene.components.length, DEFAULT_SCENE.components.length);
      assert.equal(check.skipped, 0);
      assert.match(check.summary, /^\d+ parts, \d+ beams/);
    }
  });

  it("asks for something when the box is empty", () => {
    const check = checkSceneText("   ");
    assert.equal(check.ok, false);
  });

  it("says where invalid JSON goes wrong", () => {
    const check = checkSceneText('{\n  "components": [\n    {"id": "a",}\n  ]\n}');
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.error, /line 3/);
  });

  it("finds the place in a browser's error, which quotes the text around it", () => {
    const text = '{\n  "version": 8,\n  "components": [,\n    {"id": "a"}\n  ]\n}';
    // Chrome's wording for these faults, word for word
    const cut = 'Unexpected token \',\', ..."onents": [,\n    {"id"... is not valid JSON';
    assert.equal(errorPlace(text, cut), "line 3, column 18");
    assert.equal(errorPlace('{"a" 1}', 'Unexpected token \'1\', "{"a" 1}" is not valid JSON'), "line 1, column 6");
    assert.equal(errorPlace("{", "Unexpected end of JSON input"), "line 1, column 2");
  });

  it("turns away JSON that isn't a setup", () => {
    for (const text of ["[1, 2, 3]", "42", '"setup"', '{"parts": []}', '{"components": [], "beams": {}}']) {
      assert.equal(checkSceneText(text).ok, false, text);
    }
  });

  it("turns away text over the size limit before parsing it", () => {
    const check = checkSceneText(" ".repeat(SCENE_TEXT_MAX_BYTES) + "{}");
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.error, /MB/);
  });

  it("turns away more parts than a setup may hold", () => {
    const parts = Array.from({ length: SCENE_LIMITS.components + 1 }, (_, n) => ({ ...MIRROR, id: `m${n}` }));
    const check = checkSceneText(JSON.stringify({ version: 8, components: parts }));
    assert.equal(check.ok, false);
    if (!check.ok) assert.match(check.error, /at most 500/);
  });

  it("counts what it couldn't read and left out", () => {
    const check = checkSceneText(setup({ components: [MIRROR, { id: "x", type: "warp-drive", position: [0, 0, 0] }] }));
    assert.equal(check.ok, true);
    if (check.ok) {
      assert.equal(check.scene.components.length, 1);
      assert.equal(check.skipped, 1);
    }
  });
});

describe("what a setup's text may carry", () => {
  it("keeps a real colour but drops one that could fetch from elsewhere", () => {
    const check = checkSceneText(
      setup({
        components: [
          { ...MIRROR, id: "a", color: "#8b1e3f" },
          { ...MIRROR, id: "b", color: "rgb(10, 20, 30)" },
          { ...MIRROR, id: "c", color: "url(https://example.com/x.png)" },
          { ...MIRROR, id: "d", color: "red; background: url(x)" },
        ],
      }),
    );
    assert.equal(check.ok, true);
    if (check.ok) {
      const colors = Object.fromEntries(check.scene.components.map((part) => [part.id, part.color]));
      assert.equal(colors.a, "#8b1e3f");
      assert.equal(colors.b, "rgb(10, 20, 30)");
      assert.notEqual(colors.c, "url(https://example.com/x.png)");
      assert.notEqual(colors.d, "red; background: url(x)");
    }
  });

  it("cuts a label to its limit and takes out control characters", () => {
    const check = checkSceneText(setup({ components: [{ ...MIRROR, label: "M1\u0007\n" + "x".repeat(500) }] }));
    assert.equal(check.ok, true);
    if (check.ok) {
      const label = check.scene.components[0].label ?? "";
      assert.equal(label.length, LABEL_MAX_LENGTH);
      assert.doesNotMatch(label, /[\u0000-\u001f]/);
    }
  });

  it("reads __proto__ keys as plain data", () => {
    const check = checkSceneText('{"version": 8, "components": [], "__proto__": {"polluted": true}}');
    assert.equal(check.ok, true);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
});
