import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseArrayCsv,
  parseGenericCsv,
  parseNumericCell,
  parseTimeSeriesCsv,
} from "./csv-parsing.ts";

const mokuCsv = [
  "% Moku:Go Oscilloscope",
  "% Date 2026-09-28 10:12:03",
  "% Acquisition rate: 1.25e+08 Hz",
  "% Time (s), Channel A (V), Channel B (V)",
  "-1.0e-06, 0.10, 0.20",
  "0.0e+00, 0.11, 0.21",
  "1.0e-06, 0.12, 0.22",
].join("\n");

// Avantes/Astrella spectrometer export: metadata columns, then one column per
// wavelength, with the whole spectrum on a single quoted row.
const astrellaCsv = [
  '"device timestamp","system timestamp","scope type","integration time","144.848","145.454","146.06"',
  '"67666522","2026/10/06 08:39:03.090.155","scope","1000","408.956","501.223","529.069"',
].join("\n");

describe("parseNumericCell", () => {
  it("treats a blank cell as missing, not 0", () => {
    assert.ok(Number.isNaN(parseNumericCell("")));
    assert.ok(Number.isNaN(parseNumericCell("   ")));
    assert.ok(Number.isNaN(parseNumericCell(undefined)));
  });

  it("still reads 0 as 0", () => {
    assert.equal(parseNumericCell("0"), 0);
    assert.equal(parseNumericCell(" 0 "), 0);
    assert.equal(parseNumericCell("0.0"), 0);
  });

  it("reads ordinary numbers the way Number does", () => {
    assert.equal(parseNumericCell("2"), 2);
    assert.equal(parseNumericCell("-6.7e-08"), -6.7e-8);
    assert.ok(Number.isNaN(parseNumericCell("abc")));
  });
});

describe("parseGenericCsv", () => {
  it("skips and counts a row with a blank cell", () => {
    const parsed = parseGenericCsv("x,a,b\n1,10,20\n2,,21\n3,12,0");

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.rows, [
      [1, 10, 20],
      [3, 12, 0],
    ]);
    assert.equal(parsed.rowCount, 2);
    assert.equal(parsed.skippedRowCount, 1);
  });

  it("skips a whitespace-only cell too", () => {
    const parsed = parseGenericCsv("x,a\n1,10\n2,   \n3,12");

    assert.equal(parsed.rowCount, 2);
    assert.equal(parsed.skippedRowCount, 1);
  });

  it("leaves a valid file alone", () => {
    const parsed = parseGenericCsv("x,a\n0,0\n1,1");

    assert.deepEqual(parsed.rows, [
      [0, 0],
      [1, 1],
    ]);
    assert.equal(parsed.skippedRowCount, 0);
  });

  it("turns a wide spectrometer export on its side", () => {
    const parsed = parseGenericCsv(astrellaCsv);

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.headers, ["x", "row 1"]);
    assert.deepEqual(parsed.rows, [
      [144.848, 408.956],
      [145.454, 501.223],
      [146.06, 529.069],
    ]);
    assert.equal(parsed.skippedRowCount, 0);
    assert.match(parsed.extraInfo, /system timestamp: 2026\/10\/06 08:39:03\.090\.155/);
    assert.match(parsed.extraInfo, /integration time: 1000/);
  });

  it("plots each row of a wide export as its own series", () => {
    const parsed = parseGenericCsv(
      ["label,1,2,3", "a,10,20,30", "b,11,,31"].join("\n"),
    );

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.headers, ["x", "row 1", "row 2"]);
    assert.deepEqual(parsed.rows, [
      [1, 10, 11],
      [3, 30, 31],
    ]);
    assert.equal(parsed.skippedRowCount, 1);
    assert.match(parsed.extraInfo, /row 2 · label: b/);
  });

  it("still reports no numeric data when nothing looks wide either", () => {
    const parsed = parseGenericCsv("name,unit\nfoo,bar");

    assert.equal(parsed.error, "Couldn't find any numeric data rows in this file.");
  });
});

describe("parseTimeSeriesCsv", () => {
  it("skips and counts a row with a blank channel value", () => {
    const parsed = parseTimeSeriesCsv("time,ch1,ch2\n0,1,2\n1,,21\n2,3,4");

    assert.equal(parsed.error, null);
    assert.equal(parsed.rowCount, 2);
    assert.equal(parsed.skippedRowCount, 1);
    assert.deepEqual(parsed.series[0].points, [
      { x: 0, y: 1 },
      { x: 2, y: 3 },
    ]);
  });

  it("skips and counts a row with a blank time", () => {
    const parsed = parseTimeSeriesCsv("time,ch1\n0,1\n,2\n2,3");

    assert.equal(parsed.rowCount, 2);
    assert.equal(parsed.skippedRowCount, 1);
  });

  it("opens a Moku export with %-comment metadata and header", () => {
    const parsed = parseTimeSeriesCsv(mokuCsv);

    assert.equal(parsed.error, null);
    assert.equal(parsed.xLabel, "Time (s)");
    assert.deepEqual(parsed.channelLabels, ["Channel A (V)", "Channel B (V)"]);
    assert.equal(parsed.rowCount, 3);
    assert.equal(parsed.skippedRowCount, 0);
    assert.deepEqual(parsed.series[1].points[1], { x: 0, y: 0.21 });
    assert.match(parsed.extraInfo, /Moku:Go Oscilloscope/);
  });

  it("still reads a plain file with the header on line 1", () => {
    const parsed = parseTimeSeriesCsv("ch2,ch3,time\n0.2,-0.004,-6.7e-08\n0.2,0,-6.6e-08");

    assert.equal(parsed.error, null);
    assert.equal(parsed.xLabel, "time");
    assert.deepEqual(parsed.channelLabels, ["ch2", "ch3"]);
    assert.equal(parsed.rowCount, 2);
    assert.deepEqual(parsed.series[1].points[1], { x: -6.6e-8, y: 0 });
  });
});

describe("parseArrayCsv", () => {
  it("skips and counts a row with a blank x or y", () => {
    const parsed = parseArrayCsv("x,y\n0,0\n1,\n,4\n3,9", "data.csv");

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.datasets[0].points, [
      { x: 0, y: 0 },
      { x: 3, y: 9 },
    ]);
    assert.equal(parsed.skippedRowCount, 2);
  });

  it("does not start the data block on a row with a blank cell", () => {
    const parsed = parseArrayCsv(",5\n1,2\n2,4", "data.csv");

    assert.deepEqual(parsed.datasets[0].points, [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it("still rejects a non-numeric value", () => {
    const parsed = parseArrayCsv("0,0\n1,abc", "data.csv");

    assert.match(parsed.error ?? "", /row 2 has a non-numeric x or y value/);
  });
});
