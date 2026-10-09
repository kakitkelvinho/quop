import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { BlobReader, openFits, parseHeader, type HeaderCard } from "@fits-js/core";

import { headerChips, headerRows, headerSections, rowMatches, sentinel } from "./fits-header.ts";

const bec15 = await readFile(new URL("../../../public/data/bec15.fits", import.meta.url));
const { hdus: bec15Hdus } = await openFits(new BlobReader(new Blob([bec15])));
const bec15Cards = bec15Hdus[0].header.cards;

function cards(...lines: string[]): readonly HeaderCard[] {
  const text = [...lines, "END"].map((line) => line.padEnd(80)).join("");
  const block = text.padEnd(Math.ceil(text.length / 2880) * 2880);
  return parseHeader(new TextEncoder().encode(block)).header.cards;
}

describe("headerChips", () => {
  it("reads the Andor set from bec15.fits in the decided order", () => {
    assert.deepEqual(headerChips(bec15Cards), [
      { label: "Exposure", value: { kind: "text", text: "0.00075 s" }, hint: "EXPOSURE: Total Exposure Time" },
      { label: "Gain", value: { kind: "text", text: "150" }, hint: "GAIN: Gain" },
      { label: "EM gain", value: { kind: "text", text: "0" }, hint: "EMREALGN: EM Real Gain" },
      { label: "Binning", value: { kind: "text", text: "1×1" }, hint: "HBIN×VBIN: Horizontal binning, Vertical binning" },
      { label: "Acquisition", value: { kind: "text", text: "Single Scan" }, hint: "ACQMODE: Acquisition mode" },
      { label: "Readout", value: { kind: "text", text: "Image" }, hint: "READMODE: Readout mode" },
      { label: "Trigger", value: { kind: "text", text: "External" }, hint: "TRIGGER: Trigger mode" },
      {
        label: "Temperature",
        value: { kind: "notRecorded", raw: "-999" },
        hint: "TEMP: Temperature (raw value -999)",
      },
      { label: "Subimage", value: { kind: "text", text: "771, 821, 150, 100" }, hint: "SUBRECT: Subimage format" },
    ]);
  });

  it("shows only the chips whose cards exist, binning only when both HBIN and VBIN do", () => {
    const chips = headerChips(
      cards(
        "TEMP    =                 -60. / Temperature",
        "HBIN    =                    2 / Horizontal binning",
        "EXPOSURE=                  1.5 / Total Exposure Time",
      ),
    );

    assert.deepEqual(
      chips.map((chip) => [chip.label, chip.value]),
      [
        ["Exposure", { kind: "text", text: "1.5 s" }],
        ["Temperature", { kind: "text", text: "-60 °C" }],
      ],
    );
  });

  it("joins two binning values into one chip", () => {
    const [chip] = headerChips(
      cards("HBIN    =                    4 / Horizontal binning", "VBIN    =                    2 / Vertical binning"),
    );

    assert.deepEqual(chip.value, { kind: "text", text: "4×2" });
  });
});

describe("sentinel", () => {
  it("flags TEMP = -999., Andor's value for a temperature it did not read", () => {
    assert.equal(sentinel(-999), true);
  });

  it("flags an empty string, what Andor's eight-blank SERIALNUMBER = '        ' reads as", () => {
    assert.equal(sentinel(""), true);
  });

  it("keeps -1 and 0 as readings: -1 °C is a real temperature mid-cooldown and EMREALGN = 0 means EM gain off", () => {
    assert.deepEqual([-999, -1, 0, "Image"].map(sentinel), [true, false, false, false]);
  });
});

describe("headerRows", () => {
  const rows = headerRows(bec15Cards);

  it("keeps every bec15.fits card in file order", () => {
    assert.equal(rows.length, 84);
    assert.deepEqual(rows[0], {
      kind: "card",
      keyword: "SIMPLE",
      value: { kind: "text", text: "T" },
      comment: "file does conform to FITS standard",
      card: "SIMPLE  =                    T / file does conform to FITS standard",
    });
  });

  it("turns COMMENT cards into text rows", () => {
    assert.deepEqual(rows[6], {
      kind: "text",
      keyword: "COMMENT",
      text: "FITS (Flexible Image Transport System) format is defined in 'Astronomy",
      card: "COMMENT   FITS (Flexible Image Transport System) format is defined in 'Astronomy",
    });
  });

  it("marks sentinel values not recorded and keeps the raw value", () => {
    const byKeyword = new Map(rows.map((row) => [row.keyword, row]));

    assert.deepEqual(byKeyword.get("TEMP"), {
      kind: "card",
      keyword: "TEMP",
      value: { kind: "notRecorded", raw: "-999" },
      comment: "Temperature",
      card: "TEMP    =                -999. / Temperature",
    });
    assert.deepEqual(byKeyword.get("SERIALNUMBER"), {
      kind: "card",
      keyword: "SERIALNUMBER",
      value: { kind: "notRecorded", raw: "''" },
      comment: "Camera Serial Number",
      card: "HIERARCH SERIALNUMBER = '        ' / Camera Serial Number",
    });
  });

  it("drops blank cards and keeps HISTORY as text", () => {
    assert.deepEqual(
      headerRows(cards("NAXIS   =                    0", "", "HISTORY flat-fielded with dome flats")).map(
        (row) => [row.kind, row.keyword],
      ),
      [
        ["card", "NAXIS"],
        ["text", "HISTORY"],
      ],
    );
  });
});

describe("rowMatches", () => {
  const rows = headerRows(bec15Cards);
  const keywords = (query: string) => rows.filter((row) => rowMatches(row, query)).map((row) => row.keyword);

  it("matches keyword, value or comment, ignoring case", () => {
    assert.deepEqual(keywords("temp"), ["TEMP", "UNSTTEMP"]);
    assert.deepEqual(keywords("single scan"), ["ACQMODE"]);
    assert.deepEqual(keywords("binning"), ["HBIN", "VBIN"]);
  });

  it("finds a sentinel by its raw value and COMMENT rows by their text", () => {
    assert.deepEqual(keywords("-999"), ["TEMP"]);
    assert.deepEqual(keywords("bibcode"), ["COMMENT"]);
  });

  it("returns every row for a blank query", () => {
    assert.equal(keywords("  ").length, 84);
  });
});

describe("headerSections", () => {
  it("shows bec15.fits's primary header alone, since the image lives there", () => {
    const sections = headerSections(bec15Hdus, bec15Hdus[0]);

    assert.deepEqual(
      sections.map((section) => [section.title, section.rows.length]),
      [["Primary header", 84]],
    );
  });

  it("puts the plotted extension first and the primary header after it", () => {
    const primary = { index: 0, type: "primary" as const, header: { cards: cards("SIMPLE  =                    T") } };
    const image = {
      index: 1,
      type: "image" as const,
      name: "SCI",
      header: { cards: cards("XTENSION= 'IMAGE   '", "EXTNAME = 'SCI     '") },
    };

    assert.deepEqual(
      headerSections([primary, image], image).map((section) => [section.title, section.rows.map((row) => row.keyword)]),
      [
        ["Image extension 1 (SCI)", ["XTENSION", "EXTNAME"]],
        ["Primary header", ["SIMPLE"]],
      ],
    );
  });
});
