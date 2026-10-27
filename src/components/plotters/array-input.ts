// The Array plotter's typed-in x and y arrays, kept free of React so they
// can be tested with node:test.

import type { DataPoint } from "./csv-parsing.ts";

export type ArraySeries = {
  error: string | null;
  points: DataPoint[];
  xCount: number;
  yCount: number;
};

// Reads "[0, 1, 2]" as JSON, or "0 1 2" / "0, 1, 2" as a list.
export function parseNumberArray(value: string): number[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = trimmed.startsWith("[")
    ? JSON.parse(trimmed)
    : trimmed.split(/[\s,]+/).filter(Boolean);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array of numbers.");
  }

  return parsed.map((entry) => {
    const numeric = typeof entry === "number" ? entry : Number(entry);

    if (!Number.isFinite(numeric)) {
      throw new Error("Arrays must contain only finite numbers.");
    }

    return numeric;
  });
}

// Pairs the x and y arrays into points.
export function arraySeries(xInput: string, yInput: string): ArraySeries {
  try {
    const x = parseNumberArray(xInput);
    const y = parseNumberArray(yInput);

    if (x.length === 0 || y.length === 0) {
      return {
        error: "Enter at least one value in both arrays.",
        points: [],
        xCount: x.length,
        yCount: y.length,
      };
    }

    if (x.length !== y.length) {
      return {
        error: "x and y need the same number of entries.",
        points: [],
        xCount: x.length,
        yCount: y.length,
      };
    }

    return {
      error: null,
      points: x.map((xValue, index) => ({ x: xValue, y: y[index] })),
      xCount: x.length,
      yCount: y.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to parse the arrays.",
      points: [],
      xCount: 0,
      yCount: 0,
    };
  }
}
