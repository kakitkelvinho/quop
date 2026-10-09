import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fontFamilyNames, portableFontFamily } from "./svg-export.ts";

describe("fontFamilyNames", () => {
  it("unquotes each name in a CSS font-family list", () => {
    assert.deepEqual(fontFamilyNames(`'__cmuSerif_1a2b3c', "__cmuSerif_Fallback_1a2b3c", Latin Modern Roman, serif`), [
      "__cmuSerif_1a2b3c",
      "__cmuSerif_Fallback_1a2b3c",
      "Latin Modern Roman",
      "serif",
    ]);
  });
});

describe("portableFontFamily", () => {
  it("renames next/font's web font, drops its metric fallback, and keeps the rest", () => {
    assert.equal(
      portableFontFamily(`cmuSerif, "cmuSerif Fallback", "Latin Modern Roman", "Times New Roman", serif`, {
        cmuSerif: "CMU Serif",
        "cmuSerif Fallback": null,
      }),
      "'CMU Serif', 'Latin Modern Roman', 'Times New Roman', serif",
    );
  });

  it("leaves a stack with no aliases as it was, generic names unquoted", () => {
    assert.equal(
      portableFontFamily(`"Trebuchet MS", Helvetica, sans-serif`, { cmuSerif: "CMU Serif" }),
      "'Trebuchet MS', 'Helvetica', sans-serif",
    );
  });
});
