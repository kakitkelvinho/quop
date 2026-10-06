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

export type ParsedGenericCsv = {
  error: string | null;
  headers: string[];
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

export function parseCsvRow(row: string): string[] {
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

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
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
function locateHeaderAndData(rawLines: string[]) {
  // Strip any comment marker up front so a commented header row (e.g. a
  // Moku export's "% Time (s), Channel A ...") is treated the same as a
  // plain one, and pre-compute each line's fields once.
  const lines = rawLines.map((line) => {
    const text = stripCommentPrefix(line);
    const fields = text ? parseCsvRow(text) : [];
    return { text, fields, isNumericRow: isFullyNumericRow(fields) };
  });

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
  const rawLines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

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

type CsvLine = ReturnType<typeof locateHeaderAndData>["lines"][number];

// Some spectrometer exports (e.g. Avantes/Astrella) are wide: a few metadata
// columns, then one column per wavelength, with each spectrum on a single
// row. The header's trailing numeric cells become x, and each row's matching
// cells become one y series. Returns null when the file isn't shaped that way.
function parseWideLayout(lines: CsvLine[]): ParsedGenericCsv | null {
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

export function parseGenericCsv(csv: string): ParsedGenericCsv {
  const rawLines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (rawLines.length < 2) {
    return {
      error: "Provide a header row and at least one data row.",
      headers: [],
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: "",
    };
  }

  const { lines, dataStartIndex, headerIndex, leadingInfo } =
    locateHeaderAndData(rawLines);

  if (dataStartIndex === -1) {
    const wide = parseWideLayout(lines);

    if (wide) {
      return wide;
    }

    return {
      error: "Couldn't find any numeric data rows in this file.",
      headers: [],
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: rawLines.map((line) => stripCommentPrefix(line)).join("\n"),
    };
  }

  const dataColumnCount = lines[dataStartIndex].fields.length;
  const headers =
    headerIndex === -1
      ? Array.from({ length: dataColumnCount }, (_, index) => `column_${index + 1}`)
      : lines[headerIndex].fields.map(
          (header, index) => header || `column_${index + 1}`,
        );

  if (headers.length < 2) {
    return {
      error: "CSV input must contain at least two numeric columns.",
      headers,
      rowCount: 0,
      skippedRowCount: 0,
      rows: [],
      extraInfo: leadingInfo.join("\n"),
    };
  }

  const rows: number[][] = [];
  let skippedRowCount = 0;
  const trailingInfo: string[] = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const row = lines[index];

    if (row.fields.length !== headers.length) {
      skippedRowCount += 1;
      if (row.text) trailingInfo.push(row.text);
      continue;
    }

    const numericRow = row.fields.map((field) => parseNumericCell(field));

    if (numericRow.some((value) => !Number.isFinite(value))) {
      skippedRowCount += 1;
      continue;
    }

    rows.push(numericRow);
  }

  if (rows.length === 0) {
    return {
      error: "No valid numeric data rows were found under the header row.",
      headers,
      rowCount: 0,
      skippedRowCount,
      rows: [],
      extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
    };
  }

  return {
    error: null,
    headers,
    rowCount: rows.length,
    skippedRowCount,
    rows,
    extraInfo: [...leadingInfo, ...trailingInfo].join("\n"),
  };
}

// The Array plotter's CSV upload: the first two columns are x and y.
export function parseArrayCsv(contents: string, label: string): CsvParseResult {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("%"));

  if (!lines.length) {
    return {
      datasets: [],
      error: `${label}: no usable CSV rows found.`,
      skippedRowCount: 0,
      sourceLabel: label,
    };
  }

  const dataStartIndex = lines.findIndex((line) => {
    const columns = parseCsvRow(line);

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
    const columns = parseCsvRow(lines[index]);

    if (columns.length < 2) {
      return {
        datasets: [],
        error: `${label}: row ${index + 1} does not contain at least two columns.`,
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
        error: `${label}: row ${index + 1} has a non-numeric x or y value.`,
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
