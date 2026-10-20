import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changeUnit,
  distanceQuantity,
  editField,
  energyQuantity,
  linkedTexts,
  paceQuantity,
  readNumber,
  speedQuantity,
  timeQuantity,
  wavelengthQuantity,
  type LinkedQuantities,
} from "./linked-pair.ts";
import { parsePace } from "./pace.ts";

const photon: LinkedQuantities = [wavelengthQuantity, energyQuantity];
const pace: LinkedQuantities = [paceQuantity, speedQuantity];

describe("linkedTexts", () => {
  it("agrees with the tool index samples on first load", () => {
    assert.deepEqual(linkedTexts(editField(0, "550"), photon), ["550", "2.2543"]);
    assert.deepEqual(linkedTexts(editField(0, "30"), [timeQuantity("fs"), distanceQuantity("um")]), [
      "30",
      "8.99377",
    ]);
    assert.deepEqual(linkedTexts(editField(0, "4:30"), pace), ["4:30", "13.33"]);
  });

  it("works the other field out from whichever was typed in last", () => {
    assert.deepEqual(linkedTexts(editField(1, "1.2"), photon), ["1033.2", "1.2"]);
    assert.deepEqual(linkedTexts(editField(1, "12"), pace), ["5:00", "12"]);
  });

  it("keeps the source exactly as typed", () => {
    assert.deepEqual(linkedTexts(editField(0, "1,064"), photon), ["1,064", "1.1653"]);
    assert.deepEqual(linkedTexts(editField(0, " 550.000 "), photon)[0], " 550.000 ");
  });

  it("empties the other field when the source is empty or invalid", () => {
    assert.deepEqual(linkedTexts(editField(0, ""), photon), ["", ""]);
    assert.deepEqual(linkedTexts(editField(0, "abc"), photon), ["abc", ""]);
    assert.deepEqual(linkedTexts(editField(1, "0"), photon), ["", "0"]);
    assert.deepEqual(linkedTexts(editField(1, "-3"), pace), ["", "-3"]);
    assert.deepEqual(linkedTexts(editField(0, "4:75"), pace), ["4:75", ""]);
  });

  it("reads back a value the other field wrote in scientific form", () => {
    const [, written] = linkedTexts(editField(0, "1e-15"), [timeQuantity("s"), distanceQuantity("m")]);
    assert.equal(written, "2.99792 × 10⁻⁷");
    assert.equal(readNumber(written), 2.99792e-7);
  });
});

describe("changeUnit", () => {
  it("re-expresses the source in its new unit and keeps it the source", () => {
    const before = distanceQuantity("cm");
    const after = distanceQuantity("um");
    const pair = changeUnit(editField(1, "1"), 1, before, after);
    assert.deepEqual(pair, { source: 1, text: "10000" });
    assert.deepEqual(linkedTexts(pair, [timeQuantity("ps"), after]), ["33.3564", "10000"]);
  });

  it("leaves the source alone when the other field's unit changes", () => {
    const pair = editField(0, "30");
    assert.equal(changeUnit(pair, 1, distanceQuantity("um"), distanceQuantity("mm")), pair);
    assert.deepEqual(linkedTexts(pair, [timeQuantity("fs"), distanceQuantity("mm")]), ["30", "0.00899377"]);
  });

  it("keeps a source that doesn't read as a number as typed", () => {
    const pair = editField(0, "3..0");
    assert.equal(changeUnit(pair, 0, timeQuantity("fs"), timeQuantity("ps")), pair);
  });
});

describe("parsePace", () => {
  it("takes m:ss and decimal minutes", () => {
    assert.equal(parsePace("4:30"), parsePace("4.5"));
    assert.equal(parsePace("4,5"), parsePace("4.5"));
    assert.equal(parsePace("4:05"), 60 / (4 + 5 / 60));
  });

  it("refuses seconds past 59, a stray colon and a zero pace", () => {
    assert.equal(parsePace("4:60"), null);
    assert.equal(parsePace("4:"), null);
    assert.equal(parsePace("1:2:3"), null);
    assert.equal(parsePace("0:00"), null);
    assert.equal(parsePace(""), null);
  });
});
