import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pdfPageFormat } from "./pdf-export.ts";

describe("pdfPageFormat", () => {
  it("gives a wide figure a landscape page of its size in points, at 96 px per inch", () => {
    assert.deepEqual(pdfPageFormat(800, 400), { format: [600, 300], orientation: "landscape" });
  });

  it("gives a tall or square figure a portrait page", () => {
    assert.deepEqual(pdfPageFormat(384, 512), { format: [288, 384], orientation: "portrait" });
    assert.deepEqual(pdfPageFormat(96, 96), { format: [72, 72], orientation: "portrait" });
  });

  it("keeps a fractional width, as a chart's measured size can be", () => {
    assert.deepEqual(pdfPageFormat(642.5, 321), { format: [481.875, 240.75], orientation: "landscape" });
  });
});
