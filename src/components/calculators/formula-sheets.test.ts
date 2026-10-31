import assert from "node:assert/strict";
import { describe, it } from "node:test";

import katex from "katex";

import { FORMULA_SHEETS, texGrouped, texScientific } from "./formula-sheets.ts";

describe("formula sheets", () => {
  it("write the constants as TeX", () => {
    assert.equal(texScientific(6.62607015e-34), "6.62607015 \\times 10^{-34}");
    assert.equal(texGrouped(299_792_458), "299\\,792\\,458");
  });

  it("typeset every equation and symbol without a TeX error", () => {
    for (const sheet of Object.values(FORMULA_SHEETS)) {
      for (const tex of [...sheet.equations, ...sheet.symbols.flatMap((row) => [row.symbol, row.value, row.unit])]) {
        if (tex) assert.doesNotThrow(() => katex.renderToString(tex, { throwOnError: true }), tex);
      }
    }
  });
});
