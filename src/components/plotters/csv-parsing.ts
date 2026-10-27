// The CSV reader shared by the CSV, Time CSV, Array and CSV+FITS plotters.
// Kept free of React/Chart.js so it can be tested with node:test.

export type DataPoint = {
  x: number;
  y: number;
};

// Which way a CSV's series run: down its columns, or along its rows.
export type CsvLayout = "columns" | "rows";

/**
 * A CSV as every plotter reads it: its numeric columns, a row of numbers
 * per record, and what was left out. The plotters pick their series from
 * it with the selectors in csv-series.ts.
 */
export type CsvTable = {
  error: string | null;
  headers: string[];
  /**
   * The clock columns among the headers (HH:MM:SS), their values seconds
   * from the first reading's midnight: offered as x, never as y.
   */
  clockColumns: number[];
  layout: CsvLayout;
  rowCount: number;
  skippedRowCount: number;
  // a blank or unreadable cell is NaN, a gap in its own column only
  rows: number[][];
  /**
   * Read by columns, the file's line number of each row, so an error can
   * name the line the user sees. Read by rows, empty.
   */
  rowLines: number[];
  // Read by columns, the cells that held something other than a number.
  unreadableCells: { row: number; column: number }[];
  extraInfo: string;
};

// Instrument exports (Moku, oscilloscopes, spectrometers, ...) often prefix
// metadata lines with a comment marker before the real header/data rows.
const COMMENT_PREFIXES = ["%", "#", ";", "//"];

export function isBlankCell(cell: string | undefined): boolean {
  return cell === undefined || cell.trim() === "";
}

// Number("") and Number("  ") are 0, which would plot an empty cell as a
// real zero. A blank cell is missing data, so it reads as NaN and fails the
// callers' Number.isFinite checks like any other unreadable value.
export function parseNumericCell(cell: string | undefined): number {
  return isBlankCell(cell) ? Number.NaN : Number(cell);
}

// A table's cells are split by commas or by tabs.
export type CsvSeparator = "," | "\t";

export function parseCsvRow(row: string, separator: CsvSeparator = ","): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    const nextCharacter = row[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === separator && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function isCommentLine(line: string): boolean {
  return COMMENT_PREFIXES.some((prefix) => line.startsWith(prefix));
}

type NumberedLine = { text: string; number: number };

// Splits a file into its non-blank lines, trimming spaces but not tabs, so a
// tab-separated line keeps a leading or trailing empty cell in its place.
// Each keeps its line number in the file.
function splitLines(csv: string): NumberedLine[] {
  return csv
    .split(/\r?\n/)
    .map((line, index) => ({ text: line.replace(/^ +| +$/g, ""), number: index + 1 }))
    .filter(({ text }) => text.trim() !== "");
}

const SEPARATOR_SAMPLE_LINES = 20;

/**
 * Reads a file as tab-separated when its first lines split on tabs into a
 * steady number of cells (at least 2) - the count most of them share - and
 * as comma-separated otherwise. Semicolons are never a separator: they come
 * with decimal commas (1,6;2,3), which aren't read.
 */
export function detectSeparator(lines: string[]): CsvSeparator {
  const sample = lines
    .map((line) => line.trim())
    .filter((line) => line && !isCommentLine(line))
    .slice(0, SEPARATOR_SAMPLE_LINES);
  const counts = new Map<number, number>();

  for (const line of sample) {
    const width = parseCsvRow(line, "\t").length;
    counts.set(width, (counts.get(width) ?? 0) + 1);
  }

  let commonWidth = 0;
  let commonCount = 0;

  for (const [width, count] of counts) {
    if (count > commonCount) {
      commonWidth = width;
      commonCount = count;
    }
  }

  return commonWidth >= 2 && commonCount * 2 > sample.length ? "\t" : ",";
}

function stripCommentPrefix(line: string): string {
  for (const prefix of COMMENT_PREFIXES) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }

  return line;
}

function isFullyNumericRow(fields: string[]): boolean {
  return (
    fields.length >= 2 &&
    fields.every((field) => Number.isFinite(parseNumericCell(field)))
  );
}

// Splits a file into comment-stripped lines and finds where the numeric data
// starts and which line above it is the header.
// Strips any comment marker up front so a commented header row (e.g. a
// Moku export's "% Time (s), Channel A ...") is treated the same as a plain
// one, and pre-computes each line's fields once. A column that is blank on
// every line (a separator at the end of each line, as a logger writes it)
// is dropped.
function readLines(rawLines: NumberedLine[]) {
  const separator = detectSeparator(rawLines.map((line) => line.text));
  const fieldLines = rawLines.map(({ text: line, number }) => {
    const text = stripCommentPrefix(line.trim());
    return {
      text,
      number,
      fields: text ? parseCsvRow(stripCommentPrefix(line), separator) : [],
    };
  });
  const width = Math.max(0, ...fieldLines.map((line) => line.fields.length));
  const isEmptyColumn = Array.from({ length: width }, (_, column) =>
    fieldLines.every((line) => isBlankCell(line.fields[column])),
  );
  const hasEmptyColumn = isEmptyColumn.some(Boolean);

  return fieldLines.map(({ text, number, fields: allFields }) => {
    const fields = hasEmptyColumn
      ? allFields.filter((_, column) => !isEmptyColumn[column])
      : allFields;
    return { text, number, fields, isNumericRow: isFullyNumericRow(fields) };
  });
}

type CsvLine = ReturnType<typeof readLines>[number];

function hasNumericCell(fields: string[]): boolean {
  return fields.some((field) => Number.isFinite(parseNumericCell(field)));
}

// True when the cells, read as numbers, strictly rise or strictly fall:
// wavelengths (or 1, 2, 3) rise, FTIR wavenumbers (4000 ... 400) fall.
function isSteadyRun(cells: string[]): boolean {
  const values = cells.map((cell) => parseNumericCell(cell));
  const rising = values.every((value, index) => index === 0 || value > values[index - 1]);
  const falling = values.every((value, index) => index === 0 || value < values[index - 1]);

  return rising || falling;
}

// Some spectrometer exports (e.g. Avantes/Astrella) are wide: a few metadata
// columns, then one column per wavelength, with each spectrum on a single
// row. The header's trailing numeric cells become x, and each row's matching
// cells become one y series. Returns null when the file isn't shaped that way.
// With `steadyHeaderOnly`, a header counts only when its numbers run
// steadily; a row of readings (46,70.3,48.6,58) is not a header.
function parseWideLayout(
  lines: CsvLine[],
  steadyHeaderOnly = false,
): CsvTable | null {
  const isNumericOrBlank = (cell: string) =>
    isBlankCell(cell) || Number.isFinite(parseNumericCell(cell));

  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const header = lines[headerIndex].fields;
    let xStart = header.length;

    while (xStart > 0 && Number.isFinite(parseNumericCell(header[xStart - 1]))) {
      xStart -= 1;
    }

    if (header.length - xStart < 2) {
      continue;
    }

    // checked first: the scans below are O(n) per candidate line
    if (steadyHeaderOnly && !isSteadyRun(header.slice(xStart))) {
      continue;
    }

    // A row under a header of words as wide as itself is a data row, not
    // the header of a wide export ("s1,1,2" under "sample,a,b").
    const isUnderWordHeader = lines
      .slice(0, headerIndex)
      .some(
        (line) => line.fields.length === header.length && !hasNumericCell(line.fields),
      );

    if (isUnderWordHeader) {
      continue;
    }

    const seriesLines: CsvLine[] = [];
    const trailingInfo: string[] = [];

    for (const line of lines.slice(headerIndex + 1)) {
      if (
        line.fields.length === header.length &&
        line.fields.slice(xStart).every(isNumericOrBlank)
      ) {
        seriesLines.push(line);
      } else if (line.text) {
        trailingInfo.push(line.text);
      }
    }

    if (seriesLines.length === 0) {
      continue;
    }

    const labels = seriesLines.map((_, index) => `row ${index + 1}`);
    const rows: number[][] = [];
    let skippedRowCount = 0;

    for (let column = xStart; column < header.length; column += 1) {
      const row = [
        parseNumericCell(header[column]),
        ...seriesLines.map((line) => parseNumericCell(line.fields[column])),
      ];

      if (row.every((value) => Number.isFinite(value))) {
        rows.push(row);
      } else {
        skippedRowCount += 1;
      }
    }

    if (rows.length === 0) {
      continue;
    }

    // Each row's metadata cells (timestamps, integration time, ...) are kept
    // as "name: value" lines, tagged by row when there is more than one.
    const metadata = seriesLines.flatMap((line, index) =>
      header.slice(0, xStart).map((name, column) => {
        const entry = `${name || `column_${column + 1}`}: ${line.fields[column]}`;
        return seriesLines.length > 1 ? `${labels[index]} · ${entry}` : entry;
      }),
    );

    return {
      error: null,
      headers: ["x", ...labels],
      clockColumns: [],
      layout: "rows",
      rowCount: rows.length,
      skippedRowCount,
      rows,
      rowLines: [],
      unreadableCells: [],
      extraInfo: [
        ...lines.slice(0, headerIndex).map((line) => line.text).filter(Boolean),
        "Wide layout: header values plotted as x, one series per row.",
        ...metadata,
        ...trailingInfo,
      ].join("\n"),
    };
  }

  return null;
}

const CLOCK_PATTERN = /^(\d{1,2})([:.])(\d{2})(?:\2(\d{2}(?:\.\d+)?))?$/;

/**
 * Reads a clock cell - HH:MM:SS, HH:MM or HH.MM.SS, with or without
 * fractional seconds - as seconds of the day. HH.MM (11.48) is a number,
 * not a time, and a full date-time isn't read: both are NaN.
 */
export function parseClockCell(cell: string | undefined): number {
  const match = cell?.trim().match(CLOCK_PATTERN);

  if (!match) {
    return Number.NaN;
  }

  const [, hours, separator, minutes, seconds] = match;

  if (separator === "." && seconds === undefined) {
    return Number.NaN;
  }

  const h = Number(hours);
  const m = Number(minutes);
  const sec = seconds === undefined ? 0 : Number(seconds);

  return h < 24 && m < 60 && sec < 60 ? h * 3600 + m * 60 + sec : Number.NaN;
}

const DAY_SECONDS = 24 * 3600;

// A logger's clock readings as a running time: every step back in the clock
// is a midnight passed, so a day is added from that reading on.
function runClock(cells: (string | undefined)[]): number[] {
  let day = 0;
  let previous = Number.NaN;

  return cells.map((cell) => {
    const value = parseClockCell(cell);

    if (!Number.isFinite(value)) {
      return Number.NaN;
    }

    if (value < previous) {
      day += 1;
    }

    previous = value;
    return value + day * DAY_SECONDS;
  });
}

// Reads the table the way a spreadsheet does, a column at a time. The data
// starts at the first row of numbers or, failing that, the first row with a
// number in it (a row led by a timestamp or a sample name), and the header
// is the nearest line above it with as many cells. A column that is mostly
// words is left out; a blank or unreadable cell is NaN, a gap in its own
// column only. With `readClocks`, a column of clock times is read as a
// running time instead of left out.
function readColumnTable(lines: CsvLine[], readClocks: boolean) {
  let dataStartIndex = lines.findIndex((line) => line.isNumericRow);

  if (dataStartIndex === -1) {
    dataStartIndex = lines.findIndex((line) => hasNumericCell(line.fields));
  }

  if (dataStartIndex === -1) {
    return null;
  }

  const width = lines[dataStartIndex].fields.length;
  let headerIndex = -1;

  for (let index = dataStartIndex - 1; index >= 0; index -= 1) {
    const candidate = lines[index];

    if (!candidate.isNumericRow && candidate.fields.length === width) {
      headerIndex = index;
      break;
    }
  }

  const names =
    headerIndex === -1
      ? Array.from({ length: width }, (_, index) => `column_${index + 1}`)
      : lines[headerIndex].fields.map(
          (header, index) => header || `column_${index + 1}`,
        );

  const tableLines: CsvLine[] = [];
  const trailingInfo: string[] = [];
  let skippedRowCount = 0;

  for (const line of lines.slice(dataStartIndex)) {
    if (line.fields.length === width && hasNumericCell(line.fields)) {
      tableLines.push(line);
    } else {
      skippedRowCount += 1;
      if (line.text) trailingInfo.push(line.text);
    }
  }

  const isNumericColumn = names.map((_, column) => {
    const filled = tableLines
      .map((line) => line.fields[column])
      .filter((cell) => !isBlankCell(cell));
    const numbers = filled.filter((cell) =>
      Number.isFinite(parseNumericCell(cell)),
    ).length;

    return numbers > 0 && numbers * 2 >= filled.length;
  });
  // practically every filled cell a clock reading
  const isClockColumn = names.map((_, column) => {
    if (!readClocks || isNumericColumn[column]) {
      return false;
    }

    const filled = tableLines
      .map((line) => line.fields[column])
      .filter((cell) => !isBlankCell(cell));
    const clocks = filled.filter((cell) => Number.isFinite(parseClockCell(cell))).length;

    return clocks > 0 && clocks >= filled.length * 0.9;
  });
  const plotted = names
    .map((_, column) => column)
    .filter((column) => isNumericColumn[column] || isClockColumn[column]);
  const textColumns = names
    .map((_, column) => column)
    .filter((column) => !isNumericColumn[column] && !isClockColumn[column]);
  const clockValues = new Map(
    plotted
      .filter((column) => isClockColumn[column])
      .map((column) => [column, runClock(tableLines.map((line) => line.fields[column]))]),
  );
  const rows = tableLines.map((line, row) =>
    plotted.map(
      (column) => clockValues.get(column)?.[row] ?? parseNumericCell(line.fields[column]),
    ),
  );
  const unreadableCells: { row: number; column: number }[] = [];

  rows.forEach((values, row) => {
    values.forEach((value, column) => {
      if (!Number.isFinite(value) && !isBlankCell(tableLines[row].fields[plotted[column]])) {
        unreadableCells.push({ row, column });
      }
    });
  });

  return {
    headers: plotted.map((column) => names[column]),
    clockColumns: plotted
      .map((column, index) => (isClockColumn[column] ? index : -1))
      .filter((index) => index !== -1),
    rows,
    rowLines: tableLines.map((line) => line.number),
    unreadableCells,
    // a row's first word cell (a sample name, a timestamp) names it when
    // the table is read by rows
    rowLabels: tableLines.map((line) =>
      textColumns.length ? line.fields[textColumns[0]] : "",
    ),
    textColumns: textColumns.map((column) => names[column]),
    skippedRowCount,
    leadingInfo: lines
      .slice(0, headerIndex === -1 ? dataStartIndex : headerIndex)
      .map((line) => line.text)
      .filter(Boolean),
    trailingInfo,
  };
}

/**
 * The one CSV reader every plotter uses. It finds the header and the data
 * the same way for every file and reads it into a table of numbers. With
 * `layout` "columns" each column is a series, as in a spreadsheet; with
 * "rows" each row is. Left out, a file is read by columns unless it is a
 * wide export (a header of steadily rising or falling numbers, one row per
 * spectrum), which is read by rows.
 */
export function readCsvTable(csv: string, layout?: CsvLayout): CsvTable {
  const rawLines = splitLines(csv);

  if (rawLines.length < 2) {
    return {
      error: "Provide a header row and at least one data row.",
      headers: [],
      clockColumns: [],
      layout: layout ?? "columns",
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      rowLines: [],
      unreadableCells: [],
      extraInfo: "",
    };
  }

  const lines = readLines(rawLines);
  const isPlainTable = lines.some((line) => line.isNumericRow);

  if (layout === "rows" || (layout === undefined && !isPlainTable)) {
    // auto-detect reads by rows only under a steady header of numbers
    const wide = parseWideLayout(lines, layout === undefined);

    if (wide) {
      return wide;
    }
  }

  const resolvedLayout = layout ?? "columns";
  // clock columns are x; read by rows, a row's clock reading names it
  const table = readColumnTable(lines, resolvedLayout === "columns");

  if (!table) {
    return {
      error: "Couldn't find any numeric data rows in this file.",
      headers: [],
      clockColumns: [],
      layout: resolvedLayout,
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      rowLines: [],
      unreadableCells: [],
      extraInfo: rawLines.map((line) => stripCommentPrefix(line.text)).join("\n"),
    };
  }

  const extraInfo = [
    ...table.leadingInfo,
    ...(table.textColumns.length
      ? [`Not plotted (words, not numbers): ${table.textColumns.join(", ")}`]
      : []),
    ...table.trailingInfo,
  ].join("\n");

  if (resolvedLayout === "columns") {
    return {
      error: null,
      headers: table.headers,
      clockColumns: table.clockColumns,
      layout: "columns",
      rowCount: table.rows.length,
      skippedRowCount: table.skippedRowCount,
      rows: table.rows,
      rowLines: table.rowLines,
      unreadableCells: table.unreadableCells,
      extraInfo,
    };
  }

  // By rows: each row is a series over the columns, at the header's values
  // when they are all numbers and at the column's place (1, 2, ...) if not.
  const headerValues = table.headers.map((header) => parseNumericCell(header));
  const isHeaderX = headerValues.every((value) => Number.isFinite(value));

  return {
    error: null,
    headers: [
      isHeaderX ? "x" : "column",
      ...table.rows.map((_, index) => table.rowLabels[index] || `row ${index + 1}`),
    ],
    clockColumns: [],
    layout: "rows",
    rowCount: table.headers.length,
    skippedRowCount: table.skippedRowCount,
    rows: table.headers.map((_, column) => [
      isHeaderX ? headerValues[column] : column + 1,
      ...table.rows.map((row) => row[column]),
    ]),
    rowLines: [],
    unreadableCells: [],
    extraInfo,
  };
}
