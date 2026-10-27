// Each CSV plotter's choice of series, as a small selector over the table
// readCsvTable reads. Kept free of React/Chart.js so it can be tested with
// node:test.

import type { CsvTable, DataPoint } from "./csv-parsing.ts";
import { ROW_NUMBER } from "./xy-selection.ts";

export type Series = {
  label: string;
  points: DataPoint[];
};

// The Time CSV and CSV+FITS plotters' series.
export type TimeSeries = {
  channelLabels: string[];
  error: string | null;
  // the rows with a time, each plotted in every series it has a value in
  rowCount: number;
  skippedRowCount: number;
  series: Series[];
  xLabel: string;
};

function findTimeColumn(headers: string[]) {
  return headers.findIndex((header) =>
    /(^|[^a-z])time([^a-z]|$)/i.test(header),
  );
}

// One series down each column, against the column named time. A row with
// no time is skipped; a blank cell is a gap in that series only.
export function timeSeries(table: CsvTable): TimeSeries {
  const empty = {
    channelLabels: [],
    rowCount: 0,
    skippedRowCount: 0,
    series: [],
    xLabel: "time",
  };

  if (table.error) {
    return { ...empty, error: table.error };
  }

  const timeIndex = findTimeColumn(table.headers);

  if (timeIndex === -1) {
    return { ...empty, error: "CSV input must include a column named time." };
  }

  const xLabel = table.headers[timeIndex];
  // a clock column is only ever x
  const channelIndexes = table.headers
    .map((_, index) => index)
    .filter((index) => index !== timeIndex && !table.clockColumns.includes(index));

  if (channelIndexes.length === 0) {
    return {
      ...empty,
      error: "CSV input must include at least one channel column besides time.",
      xLabel,
    };
  }

  const channelLabels = channelIndexes.map((index) => table.headers[index]);
  const series = channelLabels.map((label) => ({ label, points: [] as DataPoint[] }));
  let rowCount = 0;
  let skippedRowCount = table.skippedRowCount;

  for (const row of table.rows) {
    const x = row[timeIndex];

    if (!Number.isFinite(x)) {
      skippedRowCount += 1;
      continue;
    }

    rowCount += 1;
    channelIndexes.forEach((column, offset) => {
      if (Number.isFinite(row[column])) {
        series[offset].points.push({ x, y: row[column] });
      }
    });
  }

  if (rowCount === 0) {
    return {
      channelLabels,
      error: "No valid numeric data rows were found under the header row.",
      rowCount: 0,
      skippedRowCount,
      series: [],
      xLabel,
    };
  }

  return { channelLabels, error: null, rowCount, skippedRowCount, series, xLabel };
}

// The Array plotter's series from one uploaded file.
export type ArrayCsvSeries = {
  datasets: Series[];
  error: string | null;
  skippedRowCount: number;
  sourceLabel: string;
};

// The first two columns as x and y, one series named after the file. A
// blank x or y skips the point; any other unreadable value is an error.
export function firstTwoColumns(table: CsvTable, label: string): ArrayCsvSeries {
  const failed = (error: string) => ({
    datasets: [],
    error: `${label}: ${error}`,
    skippedRowCount: 0,
    sourceLabel: label,
  });

  if (table.error) {
    return failed(table.error);
  }

  if (table.headers.length < 2) {
    return failed("could not find a numeric x/y data block.");
  }

  const unreadable = table.unreadableCells.find(({ column }) => column < 2);
  const points: DataPoint[] = [];
  let skippedRowCount = table.skippedRowCount;

  for (const [index, row] of table.rows.entries()) {
    if (unreadable?.row === index) {
      return failed(`row ${table.rowLines[index]} has a non-numeric x or y value.`);
    }

    if (!Number.isFinite(row[0]) || !Number.isFinite(row[1])) {
      skippedRowCount += 1;
      continue;
    }

    points.push({ x: row[0], y: row[1] });
  }

  if (!points.length) {
    return { ...failed("no numeric data rows found."), skippedRowCount };
  }

  return {
    datasets: [{ label, points }],
    error: null,
    skippedRowCount,
    sourceLabel: label,
  };
}

/**
 * The CSV plotter's x column: the user's choice, else the table's clock
 * column, else its first column. ROW_NUMBER for a table of one column,
 * and a choice past the last column is the last one.
 */
export function resolveX(table: CsvTable, choice: number | null): number {
  const chosen = choice ?? table.clockColumns[0] ?? 0;

  return table.headers.length < 2 || chosen === ROW_NUMBER
    ? ROW_NUMBER
    : Math.min(chosen, table.headers.length - 1);
}

export function xLabel(table: CsvTable, x: number): string {
  return x === ROW_NUMBER ? "row number" : (table.headers[x] ?? "x");
}

// One series per chosen y column, against column x or the row number. A
// blank cell is a gap in its own series only.
export function xySeries(table: CsvTable, x: number, ys: number[]): Series[] {
  return ys.map((column) => ({
    label: table.headers[column],
    points: table.rows
      .map((row, rowIndex) => ({
        x: x === ROW_NUMBER ? rowIndex + 1 : row[x],
        y: row[column],
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  }));
}
