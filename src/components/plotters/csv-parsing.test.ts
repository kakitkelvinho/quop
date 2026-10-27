import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectSeparator,
  parseClockCell,
  parseCsvRow,
  parseNumericCell,
  readCsvTable,
} from "./csv-parsing.ts";
import { firstTwoColumns, resolveX, timeSeries, xLabel, xySeries } from "./csv-series.ts";
import { ROW_NUMBER } from "./xy-selection.ts";

// the Time CSV and Array plotters read every file by columns
const parseTimeSeriesCsv = (csv: string) => {
  const table = readCsvTable(csv, "columns");
  return { ...timeSeries(table), extraInfo: table.extraInfo };
};
const parseArrayCsv = (csv: string, label: string) =>
  firstTwoColumns(readCsvTable(csv, "columns"), label);

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

describe("readCsvTable", () => {
  it("keeps a row with a blank cell, as a gap in that column only", () => {
    const parsed = readCsvTable("x,a,b\n1,10,20\n2,,21\n3,12,0");

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
    const parsed = readCsvTable("x,a\n1,10\n2,   \n3,12");

    assert.equal(parsed.rowCount, 3);
    assert.ok(Number.isNaN(parsed.rows[1][1]));
  });

  it("reads columns of different lengths, as a spreadsheet export has", () => {
    const parsed = readCsvTable("a,b\n1,10\n2,20\n3,\n4,");

    assert.deepEqual(parsed.rows.map((row) => row[0]), [1, 2, 3, 4]);
    assert.deepEqual(parsed.rows.map((row) => row[1]), [10, 20, Number.NaN, Number.NaN]);
  });

  it("plots each column of a table led by sample names, leaving the names out", () => {
    const parsed = readCsvTable("sample,a,b\ns1,1,2\ns2,3,4\ns3,5,6");

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
    const parsed = readCsvTable(
      "time,a,b\n2026-10-23 12:00,1,2\n2026-10-23 12:01,3,4",
    );

    assert.deepEqual(parsed.headers, ["a", "b"]);
    assert.equal(parsed.rowCount, 2);
  });

  it("reads a single column", () => {
    const parsed = readCsvTable("signal\n1\n2\n3");

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.headers, ["signal"]);
    assert.deepEqual(parsed.rows, [[1], [2], [3]]);
  });

  it("reads a table by rows when asked, naming each row by its word cell", () => {
    const parsed = readCsvTable("sample,a,b\ns1,1,2\ns2,3,4", "rows");

    assert.equal(parsed.layout, "rows");
    assert.deepEqual(parsed.headers, ["column", "s1", "s2"]);
    assert.deepEqual(parsed.rows, [
      [1, 1, 3],
      [2, 2, 4],
    ]);
  });

  it("takes x from a first row of numbers when read by rows", () => {
    const parsed = readCsvTable("10,20,30\n1,2,3\n4,5,6", "rows");

    assert.deepEqual(parsed.headers, ["x", "row 1", "row 2"]);
    assert.deepEqual(parsed.rows[0], [10, 1, 4]);
  });

  it("reads a wide export by columns when asked", () => {
    const parsed = readCsvTable(
      ["label,1,2,3", "a,10,20,30", "b,11,,31"].join("\n"),
      "columns",
    );

    // its header of numbers reads as one more row of data
    assert.equal(parsed.layout, "columns");
    assert.deepEqual(parsed.headers, ["column_2", "column_3", "column_4"]);
    assert.deepEqual(parsed.rows.map((row) => row[0]), [1, 10, 11]);
  });

  it("leaves a valid file alone", () => {
    const parsed = readCsvTable("x,a\n0,0\n1,1");

    assert.deepEqual(parsed.rows, [
      [0, 0],
      [1, 1],
    ]);
    assert.equal(parsed.skippedRowCount, 0);
  });

  it("turns a wide spectrometer export on its side", () => {
    const parsed = readCsvTable(astrellaCsv);

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
    const parsed = readCsvTable(
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
    const parsed = readCsvTable(
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
    const parsed = readCsvTable(lines.join("\n"));

    assert.equal(parsed.error, null);
    assert.equal(parsed.layout, "columns");
    assert.equal(parsed.rowCount, 50);
    // every column but the garbled one, the clock among them
    assert.equal(parsed.headers.length, 8);
    assert.deepEqual(parsed.clockColumns, [1]);
  });

  it("still reports no numeric data when nothing looks wide either", () => {
    const parsed = readCsvTable("name,unit\nfoo,bar");

    assert.equal(parsed.error, "Couldn't find any numeric data rows in this file.");
  });
});

describe("clock columns", () => {
  it("reads HH.MM.SS, HH:MM:SS, HH:MM and fractional seconds", () => {
    assert.equal(parseClockCell("11.48.35"), 11 * 3600 + 48 * 60 + 35);
    assert.equal(parseClockCell("11:48:35"), 11 * 3600 + 48 * 60 + 35);
    assert.equal(parseClockCell("11:48"), 11 * 3600 + 48 * 60);
    assert.equal(parseClockCell("11:48:35.250"), 11 * 3600 + 48 * 60 + 35.25);
    assert.equal(parseClockCell("0:00:00"), 0);
  });

  it("does not read 11.48, a date-time, or an impossible time", () => {
    assert.ok(Number.isNaN(parseClockCell("11.48")));
    assert.ok(Number.isNaN(parseClockCell("2026-10-01T10:00:00")));
    assert.ok(Number.isNaN(parseClockCell("2026-10-23 12:00")));
    assert.ok(Number.isNaN(parseClockCell("25:00")));
    assert.ok(Number.isNaN(parseClockCell("12:61:00")));
  });

  it("reads a clock column as x, in seconds, instead of leaving it out", () => {
    const parsed = readCsvTable("n,time,t\n1,11:48:35,21.3\n2,11:48:45,21.4");

    assert.deepEqual(parsed.headers, ["n", "time", "t"]);
    assert.deepEqual(parsed.clockColumns, [1]);
    assert.deepEqual(parsed.rows.map((row) => row[1]), [42515, 42525]);
    assert.doesNotMatch(parsed.extraInfo, /Not plotted/);
  });

  it("runs on past midnight", () => {
    const parsed = readCsvTable(
      ["1,23.59.50,1", "2,23.59.55,2", "3,00.00.00,3", "4,00.00.05,4"].join("\n"),
    );
    const times = parsed.rows.map((row) => row[1]);

    assert.deepEqual(parsed.clockColumns, [1]);
    assert.deepEqual(times, [86390, 86395, 86400, 86405]);
  });

  it("leaves the clock as a row's name when read by rows", () => {
    const parsed = readCsvTable("time,a,b\n11:48,1,2\n11:49,3,4", "rows");

    assert.deepEqual(parsed.clockColumns, []);
    assert.deepEqual(parsed.headers, ["column", "11:48", "11:49"]);
  });
});

describe("tab-separated files", () => {
  const commaTable = ["time,a,b", "0,1,2", "1,3,4", "2,5,6"].join("\n");
  // a logger's export: CRLF line endings and a tab at the end of each line
  const tabTable = ["time\ta\tb\t", "0\t1\t2\t", "1\t3\t4\t", "2\t5\t6\t"].join("\r\n");

  it("picks tabs when the lines split on them steadily, commas otherwise", () => {
    assert.equal(detectSeparator(tabTable.split("\r\n")), "\t");
    assert.equal(detectSeparator(commaTable.split("\n")), ",");
  });

  it("reads a tab table with a trailing tab like its comma version", () => {
    const fromTabs = readCsvTable(tabTable);
    const fromCommas = readCsvTable(commaTable);

    assert.equal(fromTabs.error, null);
    assert.deepEqual(fromTabs.headers, fromCommas.headers);
    assert.deepEqual(fromTabs.rows, fromCommas.rows);
    assert.equal(fromTabs.extraInfo, "");
  });

  it("drops a column left empty by a trailing comma, without listing it", () => {
    const parsed = readCsvTable(["time,a,", "0,1,", "1,3,"].join("\n"));

    assert.deepEqual(parsed.headers, ["time", "a"]);
    assert.doesNotMatch(parsed.extraInfo, /Not plotted/);
  });

  it("reads a tab table in the Time CSV and Array plotters too", () => {
    const series = parseTimeSeriesCsv(tabTable);

    assert.equal(series.error, null);
    assert.deepEqual(series.channelLabels, ["a", "b"]);
    assert.deepEqual(series.series[1].points[2], { x: 2, y: 6 });

    const array = parseArrayCsv(tabTable, "data.txt");

    assert.equal(array.error, null);
    assert.deepEqual(array.datasets[0].points[1], { x: 1, y: 3 });
  });

  it("keeps a quoted cell with a comma in it as one cell, with either separator", () => {
    assert.deepEqual(parseCsvRow('1,"1.,4",2'), ["1", "1.,4", "2"]);
    assert.deepEqual(parseCsvRow('1\t"1.,4"\t2', "\t"), ["1", "1.,4", "2"]);

    const parsed = readCsvTable(['a\tb\tc', '1\t"1.,4"\t2', '3\t"1.,4"\t4'].join("\n"));

    assert.deepEqual(parsed.headers, ["a", "c"]);
    assert.match(parsed.extraInfo, /Not plotted \(words, not numbers\): b/);
  });

  it("does not split on semicolons", () => {
    const parsed = readCsvTable("a;b\n1;2\n3;4");

    // as before: one cell per line, none of them a number
    assert.equal(parsed.error, "Couldn't find any numeric data rows in this file.");
  });
});

describe("timeSeries", () => {
  // the one change users see: this row used to be skipped whole
  it("keeps a row with a blank channel value, as a gap in that series only", () => {
    const parsed = parseTimeSeriesCsv("time,ch1,ch2\n0,1,2\n1,,21\n2,3,4");

    assert.equal(parsed.error, null);
    assert.equal(parsed.rowCount, 3);
    assert.equal(parsed.skippedRowCount, 0);
    assert.deepEqual(parsed.series[0].points, [
      { x: 0, y: 1 },
      { x: 2, y: 3 },
    ]);
    assert.deepEqual(parsed.series[1].points, [
      { x: 0, y: 2 },
      { x: 1, y: 21 },
      { x: 2, y: 4 },
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

describe("firstTwoColumns", () => {
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

  it("skips every comment marker the other plotters skip", () => {
    const parsed = parseArrayCsv("# exported\n0,0\n1,1\n; note\n// end\n# end", "data.csv");

    assert.equal(parsed.error, null);
    assert.equal(parsed.datasets[0].points.length, 2);
  });

  it("names the file's own row number past blank and comment lines", () => {
    const parsed = parseArrayCsv("% header\n\n0,0\n\n1,abc", "data.csv");

    assert.match(parsed.error ?? "", /row 5 has a non-numeric x or y value/);
  });
});

describe("the table's line numbers and unreadable cells", () => {
  it("names each row's line in the file, past comments and blank lines", () => {
    const table = readCsvTable("% note\nx,y\n\n0,0\n# mid\n1,abc\n2,", "columns");

    assert.deepEqual(table.rowLines, [4, 6, 7]);
    // a blank cell is a gap, not an unreadable one
    assert.deepEqual(table.unreadableCells, [{ row: 1, column: 1 }]);
  });
});

describe("timeSeries, more", () => {
  it("plots against a clock column named time, leaving other clocks out", () => {
    const parsed = parseTimeSeriesCsv("time,a,start\n11:48:35,1,11:00\n11:48:45,2,11:00");

    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.channelLabels, ["a"]);
    assert.deepEqual(parsed.series[0].points, [
      { x: 42515, y: 1 },
      { x: 42525, y: 2 },
    ]);
  });

  it("asks for a time column, and for a channel besides it", () => {
    assert.equal(
      parseTimeSeriesCsv("a,b\n1,2\n3,4").error,
      "CSV input must include a column named time.",
    );
    assert.equal(
      parseTimeSeriesCsv("time\n1\n2").error,
      "CSV input must include at least one channel column besides time.",
    );
  });

  it("passes on the reader's error", () => {
    assert.equal(
      parseTimeSeriesCsv("time,a").error,
      "Provide a header row and at least one data row.",
    );
  });

  it("counts the rows the reader skipped", () => {
    const parsed = parseTimeSeriesCsv("time,a\n0,1\n1,2\nend of data");

    assert.equal(parsed.rowCount, 2);
    assert.equal(parsed.skippedRowCount, 1);
    assert.match(parsed.extraInfo, /end of data/);
  });
});

describe("firstTwoColumns, more", () => {
  it("takes the first two numeric columns as x and y", () => {
    const parsed = parseArrayCsv("name,x,y,z\na,0,1,9\nb,2,3,9", "data.csv");

    assert.deepEqual(parsed.datasets[0].points, [
      { x: 0, y: 1 },
      { x: 2, y: 3 },
    ]);
  });

  it("needs two columns", () => {
    assert.match(
      parseArrayCsv("y\n1\n2", "data.csv").error ?? "",
      /data.csv: could not find a numeric x\/y data block/,
    );
  });

  it("skips and counts a row of a different width, as the other plotters do", () => {
    const parsed = parseArrayCsv("0,0\n1,1\n2", "data.csv");

    assert.equal(parsed.error, null);
    assert.equal(parsed.datasets[0].points.length, 2);
    assert.equal(parsed.skippedRowCount, 1);
  });
});

describe("the CSV plotter's x and series", () => {
  const table = readCsvTable("n,time,a,b\n1,11:48,1,2\n2,11:49,,4\n3,11:50,5,6");

  it("starts x on the clock column, else the first column", () => {
    assert.equal(resolveX(table, null), 1);
    assert.equal(resolveX(readCsvTable("a,b\n1,2\n3,4"), null), 0);
  });

  it("keeps the user's x, clamped to the last column", () => {
    assert.equal(resolveX(table, 2), 2);
    assert.equal(resolveX(table, 9), 3);
    assert.equal(resolveX(table, ROW_NUMBER), ROW_NUMBER);
  });

  it("uses the row number for a table of one column", () => {
    const single = readCsvTable("signal\n1\n2\n3");

    assert.equal(resolveX(single, null), ROW_NUMBER);
    assert.equal(xLabel(single, ROW_NUMBER), "row number");
    assert.deepEqual(xySeries(single, ROW_NUMBER, [0]), [
      {
        label: "signal",
        points: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
      },
    ]);
  });

  it("names x by its header", () => {
    assert.equal(xLabel(table, 1), "time");
  });

  it("builds one series per y, a blank cell a gap in its own series only", () => {
    const [a, b] = xySeries(table, 0, [2, 3]);

    assert.equal(a.label, "a");
    assert.deepEqual(a.points, [
      { x: 1, y: 1 },
      { x: 3, y: 5 },
    ]);
    assert.equal(b.points.length, 3);
  });
});
