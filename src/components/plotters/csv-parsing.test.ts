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
  it("keeps a row with a blank cell, as a gap in that column only", () => {
    const parsed = parseGenericCsv("x,a,b\n1,10,20\n2,,21\n3,12,0");

    assert.equal(parsed.error, null);
    assert.equal(parsed.layout, "columns");
    assert.deepEqual(parsed.rows, [
      [1, 10, 20],
      [2, Number.NaN, 21],
      [3, 12, 0],
    ]);
    assert.equal(parsed.rowCount, 3);
    assert.equal(parsed.skippedRowCount, 0);
  });

  it("reads a whitespace-only cell as a gap too", () => {
    const parsed = parseGenericCsv("x,a\n1,10\n2,   \n3,12");

    assert.equal(parsed.rowCount, 3);
    assert.ok(Number.isNaN(parsed.rows[1][1]));
  });

  it("reads columns of different lengths, as a spreadsheet export has", () => {
    const parsed = parseGenericCsv("a,b\n1,10\n2,20\n3,\n4,");

    assert.deepEqual(parsed.rows.map((row) => row[0]), [1, 2, 3, 4]);
    assert.deepEqual(parsed.rows.map((row) => row[1]), [10, 20, Number.NaN, Number.NaN]);
  });

  it("plots each column of a table led by sample names, leaving the names out", () => {
    const parsed = parseGenericCsv("sample,a,b\ns1,1,2\ns2,3,4\ns3,5,6");

    assert.equal(parsed.error, null);
    assert.equal(parsed.layout, "columns");
    assert.deepEqual(parsed.headers, ["a", "b"]);
    assert.deepEqual(parsed.rows, [
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    assert.match(parsed.extraInfo, /Not plotted \(words, not numbers\): sample/);
  });

  it("plots each column of a table led by timestamps", () => {
    const parsed = parseGenericCsv(
      "time,a,b\n2026-10-23 12:00,1,2\n2026-10-23 12:01,3,4",
    );

    assert.deepEqual(parsed.headers, ["a", "b"]);
    assert.equal(parsed.rowCount, 2);
  });

  it("reads a single column", () => {
    const parsed = parseGenericCsv("signal\n1\n2\n3");

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.headers, ["signal"]);
    assert.deepEqual(parsed.rows, [[1], [2], [3]]);
  });

  it("reads a table by rows when asked, naming each row by its word cell", () => {
    const parsed = parseGenericCsv("sample,a,b\ns1,1,2\ns2,3,4", "rows");

    assert.equal(parsed.layout, "rows");
    assert.deepEqual(parsed.headers, ["column", "s1", "s2"]);
    assert.deepEqual(parsed.rows, [
      [1, 1, 3],
      [2, 2, 4],
    ]);
  });

  it("takes x from a first row of numbers when read by rows", () => {
    const parsed = parseGenericCsv("10,20,30\n1,2,3\n4,5,6", "rows");

    assert.deepEqual(parsed.headers, ["x", "row 1", "row 2"]);
    assert.deepEqual(parsed.rows[0], [10, 1, 4]);
  });

  it("reads a wide export by columns when asked", () => {
    const parsed = parseGenericCsv(
      ["label,1,2,3", "a,10,20,30", "b,11,,31"].join("\n"),
      "columns",
    );

    // its header of numbers reads as one more row of data
    assert.equal(parsed.layout, "columns");
    assert.deepEqual(parsed.headers, ["column_2", "column_3", "column_4"]);
    assert.deepEqual(parsed.rows.map((row) => row[0]), [1, 10, 11]);
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

  it("reads a wide export with a falling header (wavenumbers) by rows", () => {
    const parsed = parseGenericCsv(
      ["label,4000,3000,2000", "a,1,2,3", "b,4,5,6"].join("\n"),
    );

    assert.equal(parsed.layout, "rows");
    assert.deepEqual(parsed.headers, ["x", "row 1", "row 2"]);
    assert.deepEqual(parsed.rows, [
      [4000, 1, 4],
      [3000, 2, 5],
      [2000, 3, 6],
    ]);
  });

  it("reads a headerless logger file by columns, though no row is all numbers", () => {
    // a look-alike of the lab's humidity log: a clock cell and a garbled
    // cell on every row, and readings that go up and down
    const lines = Array.from({ length: 50 }, (_, index) => {
      const minute = String(index % 60).padStart(2, "0");
      return [
        index + 1,
        `11.${minute}.35`,
        (21 + (index % 3) * 0.1).toFixed(1),
        (12 + (index % 4) * 0.1).toFixed(1),
        '"1.,4"',
        46 + (index % 5),
        70.3 - (index % 2),
        48.6 + (index % 3),
        58 - (index % 4),
      ].join(",");
    });
    const parsed = parseGenericCsv(lines.join("\n"));

    assert.equal(parsed.error, null);
    assert.equal(parsed.layout, "columns");
    assert.equal(parsed.rowCount, 50);
    assert.equal(parsed.headers.length, 7);
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
