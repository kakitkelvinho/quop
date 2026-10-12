import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPrefixed, formatSignificant } from "./format-quantity.ts";

describe("significant figures", () => {
  it("writes ordinary values out in full", () => {
    assert.equal(formatSignificant(0.0318309886, 3), "0.0318");
    assert.equal(formatSignificant(1033.20456, 5), "1033.2");
    assert.equal(formatSignificant(2.25427, 5), "2.2543");
    assert.equal(formatSignificant(299792458, 5), "299790000");
  });

  it("keeps trailing zeros, which are figures too", () => {
    assert.equal(formatSignificant(1, 3), "1.00");
  });

  it("writes very small and very large values as a power of ten", () => {
    assert.equal(formatSignificant(3.18e-5, 3), "3.18 × 10⁻⁵");
    assert.equal(formatSignificant(6.02e23, 3), "6.02 × 10²³");
  });

  it("says nothing for a value that isn't a number", () => {
    assert.equal(formatSignificant(Number.NaN, 3), "—");
    assert.equal(formatSignificant(0, 3), "0");
  });
});

describe("SI prefixes", () => {
  it("scales to the prefix that puts the value between 1 and 1000", () => {
    assert.deepEqual(formatPrefixed(1e-3, "J"), { value: "1.00", unit: "mJ" });
    assert.deepEqual(formatPrefixed(2.5e-7, "J"), { value: "250", unit: "nJ" });
    assert.deepEqual(formatPrefixed(42, "J"), { value: "42.0", unit: "J" });
  });

  it("moves up a prefix when rounding reaches 1000", () => {
    assert.deepEqual(formatPrefixed(0.99996, "J"), { value: "1.00", unit: "J" });
    assert.deepEqual(formatPrefixed(9.9996e-4, "J"), { value: "1.00", unit: "mJ" });
  });
});
