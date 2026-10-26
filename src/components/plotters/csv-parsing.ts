// CSV parsing shared by the CSV, Time CSV, Array and CSV+FITS plotters.
// Kept free of React/Chart.js so it can be tested with node:test.

export type DataPoint = {
  x: number;
  y: number;
};

export type ChannelSeries = {
  label: string;
  points: DataPoint[];
};

export type ParsedCsv = {
  channelLabels: string[];
  error: string | null;
  rowCount: number;
  skippedRowCount: number;
  series: ChannelSeries[];
  xLabel: string;
  extraInfo: string;
};

// Which way a CSV's series run: down its columns, or along its rows.
export type CsvLayout = "columns" | "rows";

export type ParsedGenericCsv = {
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
  rows: number[][];
  extraInfo: string;
};

export type CsvDataset = {
  label: string;
  points: DataPoint[];
};

export type CsvParseResult = {
  datasets: CsvDataset[];
  error: string | null;
  skippedRowCount: number;
  sourceLabel: string;
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

// Splits a file into its non-blank lines, trimming spaces but not tabs, so a
// tab-separated line keeps a leading or trailing empty cell in its place.
function splitLines(csv: string): string[] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.replace(/^ +| +$/g, ""))
    .filter((line) => line.trim() !== "");
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

function findTimeColumn(headers: string[]) {
  return headers.findIndex((header) =>
    /(^|[^a-z])time([^a-z]|$)/i.test(header),
  );
}

// Splits a file into comment-stripped lines and finds where the numeric data
// starts and which line above it is the header.
// Strips any comment marker up front so a commented header row (e.g. a
// Moku export's "% Time (s), Channel A ...") is treated the same as a plain
// one, and pre-computes each line's fields once. A column that is blank on
// every line (a separator at the end of each line, as a logger writes it)
// is dropped.
function readLines(rawLines: string[]) {
  const separator = detectSeparator(rawLines);
  const fieldLines = rawLines.map((line) => {
    const text = stripCommentPrefix(line.trim());
    return { text, fields: text ? parseCsvRow(stripCommentPrefix(line), separator) : [] };
  });
  const width = Math.max(0, ...fieldLines.map((line) => line.fields.length));
  const isEmptyColumn = Array.from({ length: width }, (_, column) =>
    fieldLines.every((line) => isBlankCell(line.fields[column])),
  );
  const hasEmptyColumn = isEmptyColumn.some(Boolean);

  return fieldLines.map(({ text, fields: allFields }) => {
    const fields = hasEmptyColumn
      ? allFields.filter((_, column) => !isEmptyColumn[column])
      : allFields;
    return { text, fields, isNumericRow: isFullyNumericRow(fields) };
  });
}

function locateHeaderAndData(rawLines: string[]) {
  const lines = readLines(rawLines);

  const dataStartIndex = lines.findIndex((line) => line.isNumericRow);

  if (dataStartIndex === -1) {
    return { lines, dataStartIndex, headerIndex: -1, leadingInfo: [] };
  }

  // The header is the nearest line above the first data row whose column
  // count matches the data - everything above that (instrument settings,
  // acquisition notes, ...) is treated as metadata rather than plotted.
  const dataColumnCount = lines[dataStartIndex].fields.length;
  let headerIndex = -1;

  for (let index = dataStartIndex - 1; index >= 0; index -= 1) {
    const candidate = lines[index];

    if (!candidate.isNumericRow && candidate.fields.length === dataColumnCount) {
      headerIndex = index;
      break;
    }
  }

  const leadingInfo = lines
    .slice(0, headerIndex === -1 ? dataStartIndex : headerIndex)
    .map((line) => line.text)
    .filter(Boolean);

  return { lines, dataStartIndex, headerIndex, leadingInfo };
}

export function parseTimeSeriesCsv(csv: string): ParsedCsv {
  const rawLines = splitLines(csv);

  if (rawLines.length < 2) {
    return {
      channelLabels: [],
      error: "Provide a header row and at least one data row.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: "",
    };
  }

  const { lines, dataStartIndex, headerIndex, leadingInfo } =
    locateHeaderAndData(rawLines);

  if (dataStartIndex === -1) {
    return {
      channelLabels: [],
      error: "Couldn't find any numeric data rows in this file.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: rawLines.map((line) => stripCommentPrefix(line)).join("\n"),
    };
  }

  if (headerIndex === -1) {
    return {
      channelLabels: [],
      error:
        "Couldn't find a header row above the data with a matching number of columns.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const headers = lines[headerIndex].fields.map(
    (header, index) => header || `column_${index + 1}`,
  );

  const timeIndex = findTimeColumn(headers);

  if (timeIndex === -1) {
    return {
      channelLabels: [],
      error: "CSV input must include a column named time.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: "time",
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const channelIndexes = headers
    .map((label, index) => ({ index, label }))
    .filter(({ index }) => index !== timeIndex);

  if (channelIndexes.length === 0) {
    return {
      channelLabels: [],
      error: "CSV input must include at least one channel column besides time.",
      rowCount: 0,
      skippedRowCount: 0,
      series: [],
      xLabel: headers[timeIndex],
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const series = channelIndexes.map(({ label }) => ({
    label,
    points: [] as DataPoint[],
  }));

  let skippedRowCount = 0;
  const trailingInfo: string[] = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const row = lines[index];

    if (row.fields.length !== headers.length) {
      skippedRowCount += 1;
      if (row.text) trailingInfo.push(row.text);
      continue;
    }

    const timeValue = parseNumericCell(row.fields[timeIndex]);

    if (!Number.isFinite(timeValue)) {
      skippedRowCount += 1;
      continue;
    }

    const rowValues: number[] = [];
    let rowIsValid = true;

    for (const { index: channelIndex } of channelIndexes) {
      const value = parseNumericCell(row.fields[channelIndex]);

      if (!Number.isFinite(value)) {
        rowIsValid = false;
        break;
      }

      rowValues.push(value);
    }

    if (!rowIsValid) {
      skippedRowCount += 1;
      continue;
    }

    channelIndexes.forEach((_channel, offset) => {
      series[offset].points.push({ x: timeValue, y: rowValues[offset] });
    });
  }

  const rowCount = series[0]?.points.length ?? 0;

  if (rowCount === 0) {
    return {
      channelLabels: channelIndexes.map(({ label }) => label),
      error: "No valid numeric data rows were found under the header row.",
      rowCount: 0,
      skippedRowCount,
      series: [],
      xLabel: headers[timeIndex],
      extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
    };
  }

  return {
    channelLabels: channelIndexes.map(({ label }) => label),
    error: null,
    rowCount,
    skippedRowCount,
    series,
    xLabel: headers[timeIndex],
    extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
  };
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
): ParsedGenericCsv | null {
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

  return {
    headers: plotted.map((column) => names[column]),
    clockColumns: plotted
      .map((column, index) => (isClockColumn[column] ? index : -1))
      .filter((index) => index !== -1),
    rows: tableLines.map((line, row) =>
      plotted.map(
        (column) => clockValues.get(column)?.[row] ?? parseNumericCell(line.fields[column]),
      ),
    ),
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
 * Reads a numeric CSV into an x column and y columns. With `layout`
 * "columns" each column is a series, as in a spreadsheet; with "rows" each
 * row is. Left out, a file is read by columns unless it is a wide export
 * (a header of steadily rising or falling numbers, one row per spectrum),
 * which is read by rows.
 */
export function parseGenericCsv(csv: string, layout?: CsvLayout): ParsedGenericCsv {
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
      extraInfo: rawLines.map((line) => stripCommentPrefix(line)).join("\n"),
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
    extraInfo,
  };
}

// The Array plotter's CSV upload: the first two columns are x and y.
export function parseArrayCsv(contents: string, label: string): CsvParseResult {
  // Keep each line's number in the file, so an error names the row the user sees.
  const numbered = contents
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.replace(/^ +| +$/g, ""), number: index + 1 }))
    .filter(({ line }) => line.trim() !== "" && !isCommentLine(line.trim()));
  const lines = numbered.map(({ line }) => line);
  const separator = detectSeparator(lines);

  if (!lines.length) {
    return {
      datasets: [],
      error: `${label}: no usable CSV rows found.`,
      skippedRowCount: 0,
      sourceLabel: label,
    };
  }

  const dataStartIndex = lines.findIndex((line) => {
    const columns = parseCsvRow(line, separator);

    if (columns.length < 2) {
      return false;
    }

    const xValue = parseNumericCell(columns[0]);
    const yValue = parseNumericCell(columns[1]);
    return Number.isFinite(xValue) && Number.isFinite(yValue);
  });

  if (dataStartIndex === -1) {
    return {
      datasets: [],
      error: `${label}: could not find a numeric x/y data block.`,
      skippedRowCount: 0,
      sourceLabel: label,
    };
  }

  const points: DataPoint[] = [];
  let skippedRowCount = 0;

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const columns = parseCsvRow(lines[index], separator);

    if (columns.length < 2) {
      return {
        datasets: [],
        error: `${label}: row ${numbered[index].number} does not contain at least two columns.`,
        skippedRowCount: 0,
        sourceLabel: label,
      };
    }

    // A blank x or y is a missing point: skip it rather than plot a 0.
    if (isBlankCell(columns[0]) || isBlankCell(columns[1])) {
      skippedRowCount += 1;
      continue;
    }

    const xValue = parseNumericCell(columns[0]);
    const yValue = parseNumericCell(columns[1]);

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      return {
        datasets: [],
        error: `${label}: row ${numbered[index].number} has a non-numeric x or y value.`,
        skippedRowCount: 0,
        sourceLabel: label,
      };
    }

    points.push({ x: xValue, y: yValue });
  }

  if (!points.length) {
    return {
      datasets: [],
      error: `${label}: no numeric data rows found.`,
      skippedRowCount,
      sourceLabel: label,
    };
  }

  return {
    datasets: [{ label, points }],
    error: null,
    skippedRowCount,
    sourceLabel: label,
  };
}
