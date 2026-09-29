import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFlexibleDecimal, readFlexibleDecimal } from "./parse-flexible-decimal.ts";

function parses(input: string, expected: number) {
  const value = parseFlexibleDecimal(input);
  assert.ok(value !== null, `${JSON.stringify(input)} was rejected`);
  assert.ok(
    Math.abs(value - expected) <= Math.abs(expected) * 1e-12,
    `${JSON.stringify(input)} read as ${value}, expected ${expected}`,
  );
}

describe("parseFlexibleDecimal", () => {
  it("reads plain integers and decimals", () => {
    parses("550", 550);
    parses("1.2", 1.2);
    parses("-3", -3);
    parses("+4.5", 4.5);
    parses("  12  ", 12);
  });

  it("reads a decimal comma", () => {
    parses("0,5", 0.5);
    parses("2,5", 2.5);
    parses("0,532", 0.532);
    parses("1,06", 1.06);
    parses("1,0640", 1.064);
    parses(",5", 0.5);
  });

  it("reads a lone dot as a decimal point", () => {
    parses("1.064", 1.064);
    parses("0.532", 0.532);
    parses(".5", 0.5);
  });

  it("reads a lone comma before exactly three digits as grouping", () => {
    parses("1,064", 1064);
    parses("12,345", 12345);
    parses("-1,550", -1550);
  });

  it("keeps a comma as decimal when the integer part can't be a group", () => {
    parses("1234,567", 1234.567);
    parses("0,064", 0.064);
  });

  it("reads a repeated separator as grouping", () => {
    parses("1,000,000", 1_000_000);
    parses("1.000.000", 1_000_000);
    parses("12.345.678", 12_345_678);
  });

  it("uses the last separator as the decimal mark when both appear", () => {
    parses("1,234.5", 1234.5);
    parses("1.234,5", 1234.5);
    parses("1,234,567.25", 1_234_567.25);
    parses("1.234.567,25", 1_234_567.25);
  });

  it("reads spaces as grouping", () => {
    parses("1 000 000", 1_000_000);
    parses("1 000,5", 1000.5);
  });

  it("reads exponents", () => {
    parses("1e6", 1e6);
    parses("1E6", 1e6);
    parses("1.5E-3", 1.5e-3);
    parses("2,5e3", 2500);
    parses("1e+3", 1000);
    parses("-4.2e-9", -4.2e-9);
  });

  it("rejects malformed input", () => {
    for (const input of [
      "",
      "   ",
      "abc",
      "1..5",
      "1,,000",
      "1.5.3",
      "1,00,000",
      "1,234.5.6",
      "1.234,5,6",
      "1,5.000.000",
      "5.",
      "e6",
      "1e",
      "1e1.5",
      "1e6e2",
      "--1",
      "1-",
      "1e999",
    ]) {
      assert.equal(parseFlexibleDecimal(input), null, `${JSON.stringify(input)} was accepted`);
    }
  });
});

describe("readFlexibleDecimal", () => {
  it("has no note for unambiguous input", () => {
    for (const input of ["550", "0,5", "2,5", "0,532", "1,000,000", "1.234,5", "1e6", "1,0640"]) {
      const reading = readFlexibleDecimal(input);
      assert.ok(reading, `${JSON.stringify(input)} was rejected`);
      assert.equal(reading.note, null, `${JSON.stringify(input)} got a note`);
    }
  });

  it("notes how a lone comma before three digits was read", () => {
    assert.deepEqual(readFlexibleDecimal("1,064"), {
      value: 1064,
      note: "Read as 1064 (comma as thousands separator).",
    });
  });

  it("notes how a lone dot before three digits was read", () => {
    assert.deepEqual(readFlexibleDecimal("1.064"), {
      value: 1.064,
      note: "Read as 1.064 (dot as decimal point).",
    });
  });

  it("returns null for invalid input", () => {
    assert.equal(readFlexibleDecimal("abc"), null);
  });
});
