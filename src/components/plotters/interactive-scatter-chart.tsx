"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";

import {
  CHART_STYLE_FONTS,
  CHART_STYLE_LABELS,
  CHART_STYLE_PALETTES,
  CLASSIC_DARK,
  CLASSIC_EXPORT,
  CLASSIC_FONT_FAMILY,
  CLASSIC_LIGHT,
  setChartStyle,
  useChartStyle,
  type ChartStyle,
  type ClassicColors,
} from "@/components/plotters/chart-style";
import {
  DARK_SKIN,
  LIGHT_SKIN,
  MATPLOTLIB_FONT_FAMILY,
  matplotlibFrame,
  plainLabel,
  type MatplotlibFrameOptions,
  type SkinColors,
} from "@/components/plotters/matplotlib-skin";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

const FONT_OPTIONS = [
  { label: "Computer Modern", value: MATPLOTLIB_FONT_FAMILY },
  { label: "Trebuchet MS", value: CLASSIC_FONT_FAMILY },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: 'Garamond, "Times New Roman", serif' },
  { label: "Palatino", value: 'Palatino, "Palatino Linotype", serif' },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
];

type DragSelection =
  | {
      axis: "x";
      chartAreaBottom: number;
      chartAreaTop: number;
      chartHeight: number;
      chartWidth: number;
      currentX: number;
      startX: number;
    }
  | {
      axis: "y";
      chartAreaLeft: number;
      chartAreaRight: number;
      chartHeight: number;
      chartWidth: number;
      currentY: number;
      startY: number;
    }
  | {
      axis: "pan-y";
      currentY: number;
    }
  | {
      axis: "pan-x";
      currentX: number;
    };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getDocumentColorMode(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getAxisTitleText(title: unknown) {
  if (!title || typeof title !== "object") {
    return "";
  }

  const text = (title as { text?: string | string[] }).text;

  if (typeof text === "string") {
    return text;
  }

  if (Array.isArray(text)) {
    return text.join(" ");
  }

  return "";
}

function getFontSize(fontSource: unknown) {
  if (!fontSource || typeof fontSource !== "object") {
    return undefined;
  }

  const size = (fontSource as { size?: number }).size;
  return typeof size === "number" ? size : undefined;
}

function getAxisTitleFontSize(title: unknown) {
  if (!title || typeof title !== "object") {
    return undefined;
  }

  return getFontSize((title as { font?: unknown }).font);
}

function getChartTitleText(title: unknown) {
  if (!title || typeof title !== "object") {
    return "";
  }

  const text = (title as { text?: string | string[] }).text;

  if (typeof text === "string") {
    return text;
  }

  if (Array.isArray(text)) {
    return text.join(" ");
  }

  return "";
}

function getChartTitleFontSize(title: unknown) {
  if (!title || typeof title !== "object") {
    return undefined;
  }

  return getFontSize((title as { font?: unknown }).font);
}

function getFontFamily(fontSource: unknown) {
  if (!fontSource || typeof fontSource !== "object") {
    return undefined;
  }

  const family = (fontSource as { family?: string }).family;
  return typeof family === "string" ? family : undefined;
}

function getTickFontSize(ticks: unknown) {
  if (!ticks || typeof ticks !== "object") {
    return undefined;
  }

  return getFontSize((ticks as { font?: unknown }).font);
}

function getTickMultiplierFromExponent(exponent: number) {
  return 10 ** exponent;
}

function getDefaultTitleFromSourceLabel(sourceLabel?: string) {
  if (!sourceLabel) {
    return "";
  }

  const normalized = sourceLabel.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\.[^.]+$/, "");
}

function parseIntegerDraft(
  draft: string,
  fallback: number,
  minimum?: number,
  maximum?: number,
) {
  const parsed = Number.parseInt(draft, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (minimum !== undefined && parsed < minimum) {
    return minimum;
  }

  if (maximum !== undefined && parsed > maximum) {
    return maximum;
  }

  return parsed;
}

/**
 * The fewest decimals that show every tick exactly, as matplotlib's default
 * formatter does: 0, 5, 10 rather than 0.00, 5.00, 10.00.
 */
function autoDecimalPlaces(values: number[]) {
  let places = 0;
  for (const value of values) {
    while (places < 8 && Math.abs(Number(value.toFixed(places)) - value) > Math.abs(value) * 1e-9 + 1e-12) {
      places += 1;
    }
  }
  return places;
}

function formatTickValue(
  value: unknown,
  multiplier: number,
  /** null picks them from the ticks on the axis */
  decimalPlaces: number | null,
  ticks: { value: number }[] = [],
) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  const scaled = numeric * multiplier;

  if (decimalPlaces === null) {
    const absolute = Math.abs(scaled);
    // only the ticks written out in full decide the decimals, zero with them
    const written = ticks
      .map((tick) => tick.value * multiplier)
      .filter((tickValue) => Math.abs(tickValue) >= 1e-3 && Math.abs(tickValue) < 1e5);
    if (scaled === 0 && written.length === 0) return "0";
    if (scaled !== 0 && (absolute >= 1e5 || absolute < 1e-3)) {
      return scaled.toExponential().replace(/-/g, "\u2212");
    }
    decimalPlaces = autoDecimalPlaces(written);
  }

  if (scaled === 0) {
    return decimalPlaces > 0 ? (0).toFixed(decimalPlaces) : "0";
  }

  const absolute = Math.abs(scaled);

  // a true minus sign, as matplotlib draws it, not a hyphen
  if (absolute >= 1e5 || absolute < 1e-3) {
    return scaled.toExponential(decimalPlaces).replace(/-/g, "\u2212");
  }

  return scaled
    .toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })
    .replace(/-/g, "\u2212");
}

/**
 * One axis in the chosen style. In both, the title is laid out as plain
 * text but painted by the frame plugin, which draws its ^ / _ markup.
 *
 * matplotlib: no grid and no Chart.js border or tick marks (the plugin
 * draws the spines and inward ticks), and labels close to the spine.
 * Chart.js: its own border, outward ticks and grid, in `classic.grid`.
 */
function axisStyle(
  style: ChartStyle,
  scale: NonNullable<ChartOptions<"scatter">["scales"]>[string],
  label: string,
  classic: ClassicColors,
  factor = 1,
) {
  if (style === "chartjs") {
    return {
      grid: { ...scale?.grid, color: classic.grid },
      border: { ...scale?.border },
      ticks: {},
      title: { color: "transparent", text: plainLabel(label) },
    };
  }
  return {
    grid: { ...scale?.grid, display: false },
    border: { ...scale?.border, display: false },
    ticks: { padding: 6 * factor },
    title: {
      color: "transparent",
      text: plainLabel(label),
      padding: { top: 4 * factor, bottom: 4 * factor },
    },
  };
}

function scaledLegendBoxes(
  labels: { boxWidth?: number; boxHeight?: number } | undefined,
  factor: number,
) {
  return {
    ...(labels?.boxWidth !== undefined ? { boxWidth: labels.boxWidth * factor } : {}),
    ...(labels?.boxHeight !== undefined ? { boxHeight: labels.boxHeight * factor } : {}),
  };
}

/** Tight margins round the figure, as matplotlib's constrained layout leaves. */
function scaleLayoutPadding(factor: number) {
  return { top: 6 * factor, right: 14 * factor, bottom: 4 * factor, left: 4 * factor };
}

function cloneScatterData(
  data: ChartData<"scatter">,
  scaleFactor = 1,
): ChartData<"scatter"> {
  return {
    ...data,
    datasets: data.datasets.map((dataset) => ({
      ...dataset,
      data: (dataset.data ?? []).map((entry) =>
        typeof entry === "object" && entry !== null ? { ...entry } : entry,
      ),
      ...(typeof dataset.pointRadius === "number"
        ? { pointRadius: dataset.pointRadius * scaleFactor }
        : null),
      ...(typeof dataset.pointHoverRadius === "number"
        ? { pointHoverRadius: dataset.pointHoverRadius * scaleFactor }
        : null),
      ...(typeof dataset.borderWidth === "number"
        ? { borderWidth: dataset.borderWidth * scaleFactor }
        : null),
      ...(typeof (dataset as unknown as { radius?: number }).radius ===
      "number"
        ? {
            radius:
              (dataset as unknown as { radius: number }).radius *
              scaleFactor,
          }
        : null),
    })),
  };
}

function extractFinitePoints(data: ChartData<"scatter">) {
  const points: Array<{ x: number; y: number }> = [];

  for (const dataset of data.datasets) {
    for (const entry of dataset.data ?? []) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("x" in entry) ||
        !("y" in entry)
      ) {
        continue;
      }

      const x = Number(entry.x);
      const y = Number(entry.y);

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      points.push({ x, y });
    }
  }

  return points;
}

function buildBaseBounds(data: ChartData<"scatter">): Bounds {
  const points = extractFinitePoints(data);

  if (points.length === 0) {
    return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  }

  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    xMin = Math.min(xMin, point.x);
    xMax = Math.max(xMax, point.x);
    yMin = Math.min(yMin, point.y);
    yMax = Math.max(yMax, point.y);
  }

  const xRange = xMax - xMin || Math.max(Math.abs(xMax), 1);
  const yRange = yMax - yMin || Math.max(Math.abs(yMax), 1);

  return {
    xMin: xMin - xRange * 0.02,
    xMax: xMax + xRange * 0.02,
    yMin: yMin - yRange * 0.08,
    yMax: yMax + yRange * 0.08,
  };
}

function buildDataSignature(data: ChartData<"scatter">) {
  const points = extractFinitePoints(data);
  const baseBounds = buildBaseBounds(data);
  const datasetSummary = data.datasets
    .map((dataset, index) => {
      const entries = dataset.data ?? [];
      const first = entries[0];
      const last = entries[entries.length - 1];

      return [
        index,
        dataset.label ?? "",
        entries.length,
        typeof first === "object" &&
        first !== null &&
        "x" in first &&
        "y" in first
          ? `${Number(first.x)}:${Number(first.y)}`
          : "",
        typeof last === "object" && last !== null && "x" in last && "y" in last
          ? `${Number(last.x)}:${Number(last.y)}`
          : "",
      ].join("|");
    })
    .join("||");

  return [
    points.length,
    baseBounds.xMin,
    baseBounds.xMax,
    baseBounds.yMin,
    baseBounds.yMax,
    datasetSummary,
  ].join("::");
}

function normalizeXBounds(base: Bounds, nextMin: number, nextMax: number) {
  const baseRange = base.xMax - base.xMin || 1;
  const minimumRange = Math.max(baseRange * 0.002, 1e-12);
  let xMin = nextMin;
  let xMax = nextMax;

  if (xMax - xMin < minimumRange) {
    const center = (xMin + xMax) / 2;
    xMin = center - minimumRange / 2;
    xMax = center + minimumRange / 2;
  }

  const nextRange = xMax - xMin;

  if (nextRange >= baseRange) {
    return { xMin: base.xMin, xMax: base.xMax };
  }

  if (xMin < base.xMin) {
    xMax += base.xMin - xMin;
    xMin = base.xMin;
  }

  if (xMax > base.xMax) {
    xMin -= xMax - base.xMax;
    xMax = base.xMax;
  }

  return { xMin, xMax };
}

function normalizeYBounds(base: Bounds, nextMin: number, nextMax: number) {
  const baseRange = base.yMax - base.yMin || 1;
  const minimumRange = Math.max(baseRange * 0.002, 1e-12);
  let yMin = nextMin;
  let yMax = nextMax;

  if (yMax - yMin < minimumRange) {
    const center = (yMin + yMax) / 2;
    yMin = center - minimumRange / 2;
    yMax = center + minimumRange / 2;
  }

  const nextRange = yMax - yMin;

  if (nextRange >= baseRange) {
    return { yMin: base.yMin, yMax: base.yMax };
  }

  if (yMin < base.yMin) {
    yMax += base.yMin - yMin;
    yMin = base.yMin;
  }

  if (yMax > base.yMax) {
    yMin -= yMax - base.yMax;
    yMax = base.yMax;
  }

  return { yMin, yMax };
}

function getCanvasPoint(
  chart: ChartJS<"scatter">,
  clientX: number,
  clientY: number,
) {
  const rect = chart.canvas.getBoundingClientRect();

  return {
    x: ((clientX - rect.left) / rect.width) * chart.width,
    y: ((clientY - rect.top) / rect.height) * chart.height,
  };
}

function ResetZoomIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="10"
        cy="10"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M13 13 17 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M5 5 20 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M20 5 5 20"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15 20.5 20.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M10 6.8v6.4M6.8 10h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 15 20.5 20.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6.8 10h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4v16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 7 3.5-3 3.5 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 17 3.5 3 3.5-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M15.2 3.2a8.8 8.8 0 1 0 5.6 15.7 7.7 7.7 0 0 1-5.6-15.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function JoinDotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="6.5"
        cy="16.5"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="17.5"
        cy="7.5"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 15.2c2.3-0.1 3.9-1 5-2.2 1-1 1.6-2.1 2-3.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PointSizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M14.6 9.4 18.6 5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m16.2 5.4 2.4 0v2.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.4 14.6 5.4 18.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.8 18.6H5.4v-2.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AxisLabelsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <text
        x="5"
        y="16.2"
        fill="currentColor"
        fontFamily="Cambria Math, STIX Two Math, Times New Roman, serif"
        fontSize="12.5"
        fontStyle="italic"
        fontWeight="700"
      >
        xy
      </text>
    </svg>
  );
}

function LegendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="6.5" cy="7" r="1.5" fill="currentColor" />
      <path
        d="M10 7h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
      <path
        d="M10 12h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="6.5" cy="17" r="1.5" fill="currentColor" />
      <path
        d="M10 17h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StyleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 19.5v-2.6M14 19.5v-2.6M4.5 10h2.6M4.5 15h2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 15.5c2.2-5 4.5-7.5 9-8.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function FontIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <text
        x="5.3"
        y="17"
        fill="currentColor"
        fontFamily="Times New Roman, Times, serif"
        fontSize="14"
        fontWeight="700"
      >
        A
      </text>
    </svg>
  );
}

function TitleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.5 5.5h13v13h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <rect x="8" y="7.4" width="8" height="3.3" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function TickAxesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 18.5h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M5.5 19V5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M9 18.5v3M14 18.5v3M19 18.5v3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="M2.5 15h3M1.2 10h4.3M2.5 5h3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CustomizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="15.5" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="11" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 12H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 17h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="15.5" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17.7 7H20M17.7 17H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6 19h12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 5v10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 11.5 3.5 3.5 3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7 19v-3.5h10V19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MouseClickIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 3.4c-3 0-5.4 2.4-5.4 5.4v5.6c0 3.4 2.5 6.2 5.4 6.2s5.4-2.8 5.4-6.2V8.8c0-3-2.4-5.4-5.4-5.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 3.9v5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 5.9h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.1 6c0 1.8 1.3 3.1 3.9 3.1"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

function SelectionFrameIcon({ axis }: { axis: "x" | "y" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 24">
      <rect
        x="10"
        y="7"
        width="8"
        height="10"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      {axis === "x" ? (
        <>
          <path
            d="M2.5 12h6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            d="M25.5 12h-6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            d="m5.4 9.4-2.9 2.6 2.9 2.6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <path
            d="m22.6 9.4 2.9 2.6-2.9 2.6"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </>
      ) : (
        <>
          <path
            d="M14 2.5v3.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            d="M14 21.5V18"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            d="m11.4 5.4 2.6-2.9 2.6 2.9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
          <path
            d="m11.4 18.6 2.6 2.9 2.6-2.9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </>
      )}
    </svg>
  );
}

function InteractiveScatterChartInner({
  data,
  options,
  sourceLabel,
}: {
  data: ChartData<"scatter">;
  options: ChartOptions<"scatter">;
  sourceLabel?: string;
}) {
  const chartRef = useRef<ChartJS<"scatter"> | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null,
  );
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState(false);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const chartStyle = useChartStyle();
  const isMatplotlib = chartStyle === "matplotlib";

  useEffect(() => {
    const root = document.documentElement;
    const syncColorMode = () => {
      setColorMode(getDocumentColorMode());
    };

    syncColorMode();

    const observer = new MutationObserver(syncColorMode);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);
  // The canvas draws with whatever font is ready; once Computer Modern has
  // loaded, draw again so the first paint's fallback serif doesn't stick.
  useEffect(() => {
    let cancelled = false;
    document.fonts
      ?.load(`16px ${MATPLOTLIB_FONT_FAMILY}`)
      .then(() => {
        if (!cancelled) chartRef.current?.update("none");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [joinedPoints, setJoinedPoints] = useState(() =>
    data.datasets.some((dataset) => dataset.showLine),
  );
  // a plotter's font, if it sets one; otherwise the style's
  const plotterFontFamily =
    getFontFamily(options.font) ??
    getFontFamily(
      options.plugins?.title && typeof options.plugins.title === "object"
        ? options.plugins.title.font
        : undefined,
    ) ??
    getFontFamily(
      options.plugins?.legend && typeof options.plugins.legend === "object"
        ? options.plugins.legend.labels?.font
        : undefined,
    ) ??
    getFontFamily(options.scales?.x?.ticks?.font) ??
    getFontFamily(options.scales?.y?.ticks?.font) ??
    getFontFamily(options.scales?.x?.title?.font) ??
    getFontFamily(options.scales?.y?.title?.font);
  const [fontControlsOpen, setFontControlsOpen] = useState(false);
  // a font picked here wins over the style's, in either style
  const [pickedFontFamily, setPickedFontFamily] = useState(plotterFontFamily);
  const fontFamily = pickedFontFamily ?? CHART_STYLE_FONTS[chartStyle];
  const [styleControlsOpen, setStyleControlsOpen] = useState(false);
  const [pointSizeControlsOpen, setPointSizeControlsOpen] = useState(false);
  const [pointSize, setPointSize] = useState(() => {
    const firstDataset = data.datasets[0];
    const datasetRadius =
      typeof firstDataset?.pointRadius === "number"
        ? firstDataset.pointRadius
        : undefined;
    const optionRadius =
      typeof options.elements?.point?.radius === "number"
        ? options.elements.point.radius
        : undefined;

    return datasetRadius ?? optionRadius ?? 3;
  });
  const initialChartTitle =
    getChartTitleText(options.plugins?.title) ||
    getDefaultTitleFromSourceLabel(sourceLabel);
  const initialChartTitleFontSize =
    getChartTitleFontSize(options.plugins?.title) ?? 18;
  const [titleControlsOpen, setTitleControlsOpen] = useState(false);
  const [chartTitle, setChartTitle] = useState(initialChartTitle);
  const [chartTitleFontSize, setChartTitleFontSize] = useState(
    initialChartTitleFontSize,
  );
  const initialXAxisLabel = getAxisTitleText(options.scales?.x?.title);
  const initialYAxisLabel = getAxisTitleText(options.scales?.y?.title);
  const initialAxisLabelFontSize =
    getAxisTitleFontSize(options.scales?.x?.title) ??
    getAxisTitleFontSize(options.scales?.y?.title) ??
    14;
  const [axisControlsOpen, setAxisControlsOpen] = useState(false);
  const [xAxisLabel, setXAxisLabel] = useState(initialXAxisLabel);
  const [yAxisLabel, setYAxisLabel] = useState(initialYAxisLabel);
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(
    initialAxisLabelFontSize,
  );
  const initialLegendFontSize =
    getFontSize(options.plugins?.legend?.labels?.font) ?? 12;
  const [legendControlsOpen, setLegendControlsOpen] = useState(false);
  const [legendFontSize, setLegendFontSize] = useState(initialLegendFontSize);
  const initialXTickFontSize = getTickFontSize(options.scales?.x?.ticks) ?? 12;
  const initialYTickFontSize = getTickFontSize(options.scales?.y?.ticks) ?? 12;
  const [tickControlsOpen, setTickControlsOpen] = useState(false);
  const [xTickMultiplier, setXTickMultiplier] = useState(1);
  const [yTickMultiplier, setYTickMultiplier] = useState(1);
  const [xTickExponent, setXTickExponent] = useState(0);
  const [yTickExponent, setYTickExponent] = useState(0);
  const [xTickExponentDraft, setXTickExponentDraft] = useState("0");
  const [yTickExponentDraft, setYTickExponentDraft] = useState("0");
  // null: automatic, from the ticks on the axis
  const [xTickDecimalPlaces, setXTickDecimalPlaces] = useState<number | null>(null);
  const [yTickDecimalPlaces, setYTickDecimalPlaces] = useState<number | null>(null);
  const [xTickDecimalPlacesDraft, setXTickDecimalPlacesDraft] = useState("");
  const [yTickDecimalPlacesDraft, setYTickDecimalPlacesDraft] = useState("");
  const [xTickFontSize, setXTickFontSize] = useState(initialXTickFontSize);
  const [yTickFontSize, setYTickFontSize] = useState(initialYTickFontSize);
  const [saveControlsOpen, setSaveControlsOpen] = useState(false);
  const [saveHighQuality, setSaveHighQuality] = useState(true);
  const [saveWhiteBackground, setSaveWhiteBackground] = useState(true);
  const [customizeMenuOpen, setCustomizeMenuOpen] = useState(false);
  const anyCustomizeControlOpen =
    styleControlsOpen ||
    pointSizeControlsOpen ||
    fontControlsOpen ||
    titleControlsOpen ||
    axisControlsOpen ||
    legendControlsOpen ||
    tickControlsOpen;
  const baseBounds = useMemo(() => buildBaseBounds(data), [data]);
  const [viewport, setViewport] = useState<Bounds>(baseBounds);

  function zoomY(factor: number, anchor?: number) {
    setViewport((current) => {
      const center = anchor ?? (current.yMin + current.yMax) / 2;
      const next = normalizeYBounds(
        baseBounds,
        center - (center - current.yMin) * factor,
        center + (current.yMax - center) * factor,
      );

      return { ...current, ...next };
    });
  }

  function zoomBoth(factor: number) {
    setViewport((current) => {
      const xCenter = (current.xMin + current.xMax) / 2;
      const yCenter = (current.yMin + current.yMax) / 2;
      const nextX = normalizeXBounds(
        baseBounds,
        xCenter - (xCenter - current.xMin) * factor,
        xCenter + (current.xMax - xCenter) * factor,
      );
      const nextY = normalizeYBounds(
        baseBounds,
        yCenter - (yCenter - current.yMin) * factor,
        yCenter + (current.yMax - yCenter) * factor,
      );

      return { ...current, ...nextX, ...nextY };
    });
  }

  function panX(previousPixel: number, nextPixel: number, chart: ChartJS<"scatter">) {
    const xScale = chart.scales.x;
    const previousValue = xScale.getValueForPixel(previousPixel);
    const nextValue = xScale.getValueForPixel(nextPixel);

    if (previousValue === undefined || nextValue === undefined) {
      return;
    }

    const shift = previousValue - nextValue;
    setViewport((current) => {
      const next = normalizeXBounds(
        baseBounds,
        current.xMin + shift,
        current.xMax + shift,
      );

      return { ...current, ...next };
    });
  }

  function clearDragSelection() {
    setDragSelection(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart || event.button !== 0) {
      return;
    }

    const point = getCanvasPoint(chart, event.clientX, event.clientY);
    const chartArea = chart.chartArea;
    const isWithinPlot =
      point.x >= chartArea.left &&
      point.x <= chartArea.right &&
      point.y >= chartArea.top &&
      point.y <= chartArea.bottom;
    const isWithinYAxis =
      !event.shiftKey &&
      point.x >= 0 &&
      point.x < chartArea.left &&
      point.y >= chartArea.top &&
      point.y <= chartArea.bottom;
    const isWithinXAxis =
      !event.shiftKey &&
      point.x >= chartArea.left &&
      point.x <= chartArea.right &&
      point.y > chartArea.bottom &&
      point.y <= chart.height;

    if (!isWithinPlot && !isWithinYAxis && !isWithinXAxis) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isWithinYAxis) {
      setDragSelection({
        axis: "pan-y",
        currentY: clamp(point.y, chartArea.top, chartArea.bottom),
      });
      return;
    }

    if (isWithinXAxis) {
      setDragSelection({
        axis: "pan-x",
        currentX: clamp(point.x, chartArea.left, chartArea.right),
      });
      return;
    }

    if (event.shiftKey && isWithinPlot) {
      setDragSelection({
        axis: "y",
        chartAreaLeft: chartArea.left,
        chartAreaRight: chartArea.right,
        chartHeight: chart.height,
        chartWidth: chart.width,
        currentY: point.y,
        startY: point.y,
      });
      return;
    }

    setDragSelection({
      axis: "x",
      chartAreaBottom: chartArea.bottom,
      chartAreaTop: chartArea.top,
      chartHeight: chart.height,
      chartWidth: chart.width,
      currentX: point.x,
      startX: point.x,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart || !dragSelection) {
      return;
    }

    const point = getCanvasPoint(chart, event.clientX, event.clientY);
    const chartArea = chart.chartArea;

    if (dragSelection.axis === "pan-y") {
      const nextY = clamp(point.y, chartArea.top, chartArea.bottom);
      const yScale = chart.scales.y;
      const previousValue = yScale.getValueForPixel(dragSelection.currentY);
      const nextValue = yScale.getValueForPixel(nextY);

      if (previousValue !== undefined && nextValue !== undefined) {
        const shift = previousValue - nextValue;
        setViewport((current) => {
          const next = normalizeYBounds(
            baseBounds,
            current.yMin + shift,
            current.yMax + shift,
          );

          return { ...current, ...next };
        });
      }

      setDragSelection({
        ...dragSelection,
        currentY: nextY,
      });
      return;
    }

    if (dragSelection.axis === "pan-x") {
      const nextX = clamp(point.x, chartArea.left, chartArea.right);
      panX(dragSelection.currentX, nextX, chart);
      setDragSelection({
        ...dragSelection,
        currentX: nextX,
      });
      return;
    }

    if (dragSelection.axis === "x") {
      setDragSelection({
        ...dragSelection,
        currentX: clamp(point.x, chartArea.left, chartArea.right),
      });
      return;
    }

    setDragSelection({
      ...dragSelection,
      currentY: clamp(point.y, chartArea.top, chartArea.bottom),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart || !dragSelection) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const activeSelection = dragSelection;
    setDragSelection(null);

    if (activeSelection.axis === "pan-y" || activeSelection.axis === "pan-x") {
      return;
    }

    if (activeSelection.axis === "x") {
      const startX = activeSelection.startX;
      const endX = activeSelection.currentX;

      if (Math.abs(endX - startX) < 6) {
        return;
      }

      const xScale = chart.scales.x;
      const left = Math.min(startX, endX);
      const right = Math.max(startX, endX);
      const leftValue = xScale.getValueForPixel(left);
      const rightValue = xScale.getValueForPixel(right);

      if (leftValue === undefined || rightValue === undefined) {
        return;
      }

      const next = normalizeXBounds(baseBounds, leftValue, rightValue);
      setViewport((current) => ({ ...current, ...next }));
      return;
    }

    const startY = activeSelection.startY;
    const endY = activeSelection.currentY;

    if (Math.abs(endY - startY) < 6) {
      return;
    }

    const yScale = chart.scales.y;
    const top = Math.min(startY, endY);
    const bottom = Math.max(startY, endY);
    const topValue = yScale.getValueForPixel(top);
    const bottomValue = yScale.getValueForPixel(bottom);

    if (topValue === undefined || bottomValue === undefined) {
      return;
    }

    const next = normalizeYBounds(
      baseBounds,
      Math.min(topValue, bottomValue),
      Math.max(topValue, bottomValue),
    );

    setViewport((current) => ({ ...current, ...next }));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart || !scrollZoomEnabled) {
      return;
    }

    const point = getCanvasPoint(chart, event.clientX, event.clientY);
    const chartArea = chart.chartArea;

    if (
      point.x < chartArea.left ||
      point.x > chartArea.right ||
      point.y < chartArea.top ||
      point.y > chartArea.bottom
    ) {
      return;
    }

    event.preventDefault();
    const yScale = chart.scales.y;
    const anchor = yScale.getValueForPixel(point.y);
    zoomY(event.deltaY < 0 ? 0.85 : 1.18, anchor);
  }

  function handleTickExponentChange(axis: "x" | "y", draft: string) {
    if (axis === "x") {
      setXTickExponentDraft(draft);

      if (draft.trim() === "" || draft === "-") {
        return;
      }

      const nextExponent = parseIntegerDraft(draft, xTickExponent);
      setXTickExponent(nextExponent);
      setXTickMultiplier(getTickMultiplierFromExponent(nextExponent));
      return;
    }

    setYTickExponentDraft(draft);

    if (draft.trim() === "" || draft === "-") {
      return;
    }

    const nextExponent = parseIntegerDraft(draft, yTickExponent);
    setYTickExponent(nextExponent);
    setYTickMultiplier(getTickMultiplierFromExponent(nextExponent));
  }

  function handleTickDecimalPlacesChange(axis: "x" | "y", draft: string) {
    if (axis === "x") {
      setXTickDecimalPlacesDraft(draft);
      // an empty field goes back to automatic
      setXTickDecimalPlaces(
        draft.trim() === "" ? null : parseIntegerDraft(draft, xTickDecimalPlaces ?? 2, 0, 12),
      );
      return;
    }

    setYTickDecimalPlacesDraft(draft);
    setYTickDecimalPlaces(
      draft.trim() === "" ? null : parseIntegerDraft(draft, yTickDecimalPlaces ?? 2, 0, 12),
    );
  }

  function getExportFileName() {
    const baseName = (chartTitle || xAxisLabel || yAxisLabel || "scatter-chart")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return baseName || "scatter-chart";
  }

  function handleSave() {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const scaleFactor = saveHighQuality ? 3 : 1;
    const exportWidth = Math.max(1, Math.round(chart.width * scaleFactor));
    const exportHeight = Math.max(1, Math.round(chart.height * scaleFactor));
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    // an export is always the light, paper-ready figure, whatever the screen shows
    const exportTextColor = isMatplotlib ? LIGHT_SKIN.text : CLASSIC_EXPORT.text;
    const exportFrame: MatplotlibFrameOptions = {
      colors: isMatplotlib ? LIGHT_SKIN : { text: CLASSIC_EXPORT.text, frame: CLASSIC_EXPORT.grid },
      labels: { x: xAxisLabel, y: yAxisLabel },
      scale: scaleFactor,
      frame: isMatplotlib,
    };
    const exportXSkin = axisStyle(
      chartStyle,
      mergedOptions.scales?.x,
      xAxisLabel,
      CLASSIC_EXPORT,
      scaleFactor,
    );
    const exportYSkin = axisStyle(
      chartStyle,
      mergedOptions.scales?.y,
      yAxisLabel,
      CLASSIC_EXPORT,
      scaleFactor,
    );
    const exportData = cloneScatterData(chartData, scaleFactor);
    const exportOptions: ChartOptions<"scatter"> = {
      ...mergedOptions,
      responsive: false,
      animation: false,
      color: exportTextColor,
      layout: isMatplotlib ? { padding: scaleLayoutPadding(scaleFactor) } : mergedOptions.layout,
      elements: {
        ...mergedOptions.elements,
        point: {
          ...mergedOptions.elements?.point,
          hoverRadius:
            Math.max(pointSize + 1.5, pointSize * 1.5) * scaleFactor,
          radius: pointSize * scaleFactor,
        },
      },
      plugins: {
        ...mergedOptions.plugins,
        legend: mergedOptions.plugins?.legend
          ? {
              ...mergedOptions.plugins.legend,
              labels: {
                ...mergedOptions.plugins.legend.labels,
                // swatch sizes scale with the text, or a point-style dot swamps its label
                ...scaledLegendBoxes(mergedOptions.plugins.legend.labels, scaleFactor),
                color: exportTextColor,
                font: {
                  ...mergedOptions.plugins.legend.labels?.font,
                  family: fontFamily,
                  size: legendFontSize * scaleFactor,
                },
              },
            }
          : mergedOptions.plugins?.legend,
        title: mergedOptions.plugins?.title
          ? {
              ...mergedOptions.plugins.title,
              color: exportTextColor,
              font: {
                ...mergedOptions.plugins.title.font,
                family: fontFamily,
                size: chartTitleFontSize * scaleFactor,
              },
            }
          : mergedOptions.plugins?.title,
        tooltip: mergedOptions.plugins?.tooltip
          ? {
              ...mergedOptions.plugins.tooltip,
              bodyColor: exportTextColor,
              titleColor: exportTextColor,
            }
          : mergedOptions.plugins?.tooltip,
        matplotlibFrame: exportFrame,
      },
      scales: {
        ...mergedOptions.scales,
        x: {
          ...mergedOptions.scales?.x,
          ...exportXSkin,
          ticks: {
            ...mergedOptions.scales?.x?.ticks,
            ...exportXSkin.ticks,
            color: exportTextColor,
            font: {
              ...mergedOptions.scales?.x?.ticks?.font,
              family: fontFamily,
              size: xTickFontSize * scaleFactor,
            },
          },
          title: {
            ...mergedOptions.scales?.x?.title,
            ...exportXSkin.title,
            font: {
              ...mergedOptions.scales?.x?.title?.font,
              family: fontFamily,
              size: axisLabelFontSize * scaleFactor,
            },
          },
        },
        y: {
          ...mergedOptions.scales?.y,
          ...exportYSkin,
          ticks: {
            ...mergedOptions.scales?.y?.ticks,
            ...exportYSkin.ticks,
            color: exportTextColor,
            font: {
              ...mergedOptions.scales?.y?.ticks?.font,
              family: fontFamily,
              size: yTickFontSize * scaleFactor,
            },
          },
          title: {
            ...mergedOptions.scales?.y?.title,
            ...exportYSkin.title,
            font: {
              ...mergedOptions.scales?.y?.title?.font,
              family: fontFamily,
              size: axisLabelFontSize * scaleFactor,
            },
          },
        },
      },
    };

    const exportPlugins = saveWhiteBackground
      ? [
          matplotlibFrame,
          {
            id: "exportBackground",
            beforeDraw(exportChart: ChartJS<"scatter">) {
              const { ctx, width, height } = exportChart;
              ctx.save();
              ctx.globalCompositeOperation = "destination-over";
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
              ctx.restore();
            },
          },
        ]
      : [matplotlibFrame];

    const exportChart = new ChartJS(exportCanvas, {
      type: "scatter",
      data: exportData,
      options: exportOptions,
      plugins: exportPlugins,
    });

    try {
      const imageUrl = exportChart.toBase64Image("image/png", 1);

      if (!imageUrl) {
        return;
      }

      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${getExportFileName()}${saveHighQuality ? "-hq" : ""}.png`;
      link.click();
    } finally {
      exportChart.destroy();
    }
  }

  const selectionStyle =
    dragSelection?.axis === "x"
      ? {
          left: `${(Math.min(dragSelection.startX, dragSelection.currentX) / dragSelection.chartWidth) * 100}%`,
          width: `${(Math.abs(dragSelection.currentX - dragSelection.startX) / dragSelection.chartWidth) * 100}%`,
          top: `${(dragSelection.chartAreaTop / dragSelection.chartHeight) * 100}%`,
          height: `${((dragSelection.chartAreaBottom - dragSelection.chartAreaTop) / dragSelection.chartHeight) * 100}%`,
        }
      : dragSelection?.axis === "y"
        ? {
            left: `${(dragSelection.chartAreaLeft / dragSelection.chartWidth) * 100}%`,
            width: `${((dragSelection.chartAreaRight - dragSelection.chartAreaLeft) / dragSelection.chartWidth) * 100}%`,
            top: `${(Math.min(dragSelection.startY, dragSelection.currentY) / dragSelection.chartHeight) * 100}%`,
            height: `${(Math.abs(dragSelection.currentY - dragSelection.startY) / dragSelection.chartHeight) * 100}%`,
          }
        : null;

  const isDarkMode = colorMode === "dark";
  const skin: SkinColors = isDarkMode ? DARK_SKIN : LIGHT_SKIN;
  const classic = isDarkMode ? CLASSIC_DARK : CLASSIC_LIGHT;
  const chartTextColor = isMatplotlib ? skin.text : classic.text;
  const xSkin = axisStyle(chartStyle, options.scales?.x, xAxisLabel, classic);
  const ySkin = axisStyle(chartStyle, options.scales?.y, yAxisLabel, classic);
  const chartData = useMemo<ChartData<"scatter">>(() => {
    const palette = CHART_STYLE_PALETTES[chartStyle];
    return {
      ...data,
      datasets: data.datasets.map((dataset, index) => ({
        ...dataset,
        // the style's colour cycle, by series, whatever the plotter passed
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        // matplotlib's lines.linewidth
        borderWidth: chartStyle === "matplotlib" ? 1.5 : dataset.borderWidth,
        pointHoverRadius: Math.max(pointSize + 1.5, pointSize * 1.5),
        pointRadius: pointSize,
        radius: pointSize,
        showLine: joinedPoints,
      })),
    };
  }, [chartStyle, data, joinedPoints, pointSize]);
  const mergedOptions: ChartOptions<"scatter"> = {
    ...options,
    animation:
      dragSelection?.axis === "pan-y" || dragSelection?.axis === "pan-x"
        ? false
        : options.animation,
    color: chartTextColor,
    font: {
      ...options.font,
      family: fontFamily,
    },
    layout: isMatplotlib ? { padding: scaleLayoutPadding(1) } : options.layout,
    plugins: {
      ...options.plugins,
      matplotlibFrame: {
        colors: isMatplotlib ? skin : { text: classic.text, frame: classic.grid },
        labels: { x: xAxisLabel, y: yAxisLabel },
        frame: isMatplotlib,
      },
      legend: options.plugins?.legend
        ? {
            ...options.plugins.legend,
            labels: {
              ...options.plugins.legend.labels,
              ...(isMatplotlib ? { usePointStyle: true, boxHeight: 5 } : {}),
              color: chartTextColor,
              font: {
                ...options.plugins.legend.labels?.font,
                family: fontFamily,
                size: legendFontSize,
              },
            },
          }
        : options.plugins?.legend,
      title: {
        ...options.plugins?.title,
        color: chartTextColor,
        display: Boolean(chartTitle),
        font: {
          ...options.plugins?.title?.font,
          family: fontFamily,
          size: chartTitleFontSize,
          // matplotlib titles are set in the regular weight, Chart.js's in bold
          weight: isMatplotlib ? "normal" : "bold",
        },
        text: chartTitle,
      },
      tooltip: {
        ...options.plugins?.tooltip,
        backgroundColor: isDarkMode
          ? "rgba(15, 19, 28, 0.96)"
          : "rgba(255, 251, 245, 0.96)",
        bodyColor: chartTextColor,
        bodyFont: {
          ...options.plugins?.tooltip?.bodyFont,
          family: fontFamily,
        },
        borderColor: isDarkMode
          ? "rgba(148, 163, 184, 0.35)"
          : "rgba(91, 102, 117, 0.22)",
        borderWidth: 1,
        titleColor: chartTextColor,
        titleFont: {
          ...options.plugins?.tooltip?.titleFont,
          family: fontFamily,
        },
      },
    },
    elements: {
      ...options.elements,
      point: {
        ...options.elements?.point,
        hoverRadius: Math.max(pointSize + 1.5, pointSize * 1.5),
        radius: pointSize,
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      ...options.scales,
      x: {
        ...options.scales?.x,
        ...xSkin,
        max: viewport.xMax,
        min: viewport.xMin,
        ticks: {
          ...options.scales?.x?.ticks,
          ...xSkin.ticks,
          callback: (value, _index, ticks) =>
            formatTickValue(value, xTickMultiplier, xTickDecimalPlaces, ticks),
          color: chartTextColor,
          font: {
            ...options.scales?.x?.ticks?.font,
            family: fontFamily,
            size: xTickFontSize,
          },
          includeBounds: false,
        },
        title: {
          ...options.scales?.x?.title,
          ...xSkin.title,
          display: Boolean(xAxisLabel),
          font: {
            ...options.scales?.x?.title?.font,
            family: fontFamily,
            size: axisLabelFontSize,
          },
        },
      },
      y: {
        ...options.scales?.y,
        ...ySkin,
        max: viewport.yMax,
        min: viewport.yMin,
        ticks: {
          ...options.scales?.y?.ticks,
          ...ySkin.ticks,
          callback: (value, _index, ticks) =>
            formatTickValue(value, yTickMultiplier, yTickDecimalPlaces, ticks),
          color: chartTextColor,
          font: {
            ...options.scales?.y?.ticks?.font,
            family: fontFamily,
            size: yTickFontSize,
          },
          includeBounds: false,
        },
        title: {
          ...options.scales?.y?.title,
          ...ySkin.title,
          display: Boolean(yAxisLabel),
          font: {
            ...options.scales?.y?.title?.font,
            family: fontFamily,
            size: axisLabelFontSize,
          },
        },
      },
    },
  };

  return (
    <div
      className={`interactiveChart interactiveChart--${colorMode} interactiveChart--${chartStyle}`}
    >
      <div
        className="interactiveChart__stage"
        onPointerDown={handlePointerDown}
        onPointerLeave={clearDragSelection}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <Scatter
          data={chartData}
          options={mergedOptions}
          plugins={[matplotlibFrame]}
          ref={chartRef}
        />
        {selectionStyle ? (
          <div
            className={`interactiveChart__selection interactiveChart__selection--${dragSelection?.axis}`}
            style={selectionStyle}
          />
        ) : null}
      </div>

      <div className="interactiveChart__footer">
        <button
          aria-label="Reset zoom"
          className="interactiveChart__iconButton"
          onClick={() => {
            setViewport(baseBounds);
            setDragSelection(null);
          }}
          title="Reset zoom"
          type="button"
        >
          <ResetZoomIcon />
        </button>
        <button
          aria-label="Zoom in"
          className="interactiveChart__iconButton"
          onClick={() => zoomBoth(0.8)}
          title="Zoom in"
          type="button"
        >
          <ZoomInIcon />
        </button>
        <button
          aria-label="Zoom out"
          className="interactiveChart__iconButton"
          onClick={() => zoomBoth(1.25)}
          title="Zoom out"
          type="button"
        >
          <ZoomOutIcon />
        </button>
        <button
          aria-label={
            scrollZoomEnabled ? "Disable scroll zoom" : "Enable scroll zoom"
          }
          aria-pressed={scrollZoomEnabled}
          className={`interactiveChart__iconButton ${scrollZoomEnabled ? "is-active" : ""}`}
          onClick={() => setScrollZoomEnabled((current) => !current)}
          title={scrollZoomEnabled ? "Scroll zoom on" : "Scroll zoom off"}
          type="button"
        >
          <ScrollIcon />
        </button>
        <button
          aria-label={joinedPoints ? "Show points only" : "Join points"}
          aria-pressed={joinedPoints}
          className={`interactiveChart__iconButton interactiveChart__iconButton--join ${joinedPoints ? "is-joined" : ""}`}
          onClick={() => setJoinedPoints((current) => !current)}
          title={joinedPoints ? "Lines on" : "Lines off"}
          type="button"
        >
          <JoinDotsIcon />
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        <button
          aria-expanded={customizeMenuOpen}
          aria-label={
            customizeMenuOpen ? "Hide customize menu" : "Show customize menu"
          }
          className={`interactiveChart__iconButton interactiveChart__iconButton--customize ${customizeMenuOpen || anyCustomizeControlOpen ? "is-active" : ""}`}
          onClick={() => setCustomizeMenuOpen((current) => !current)}
          title="Customize (point size, font, title, axis labels, legend, ticks)"
          type="button"
        >
          <CustomizeIcon />
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        <button
          aria-label={
            colorMode === "dark"
              ? "Switch this chart to bright mode"
              : "Switch this chart to dark mode"
          }
          aria-pressed={colorMode === "dark"}
          className={`interactiveChart__iconButton interactiveChart__iconButton--theme ${colorMode === "dark" ? "is-dark" : ""}`}
          onClick={() =>
            setColorMode((current) => (current === "dark" ? "light" : "dark"))
          }
          title={colorMode === "dark" ? "Bright mode" : "Dark mode"}
          type="button"
        >
          <ThemeIcon />
        </button>
        <button
          aria-label={
            saveControlsOpen ? "Hide save options" : "Show save options"
          }
          aria-pressed={saveControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--save ${saveControlsOpen ? "is-open" : ""}`}
          onClick={() => setSaveControlsOpen((current) => !current)}
          title="Save"
          type="button"
        >
          <SaveIcon />
        </button>
      </div>

      {customizeMenuOpen ? (
        <div className="interactiveChart__customizeMenu">
          <button
            aria-pressed={styleControlsOpen}
            className={`interactiveChart__customizeMenuItem ${styleControlsOpen ? "is-active" : ""}`}
            onClick={() => setStyleControlsOpen((current) => !current)}
            type="button"
          >
            <StyleIcon />
            <span>Style</span>
          </button>
          <button
            aria-pressed={pointSizeControlsOpen}
            className={`interactiveChart__customizeMenuItem ${pointSizeControlsOpen ? "is-active" : ""}`}
            onClick={() => setPointSizeControlsOpen((current) => !current)}
            type="button"
          >
            <PointSizeIcon />
            <span>Point size</span>
          </button>
          <button
            aria-pressed={fontControlsOpen}
            className={`interactiveChart__customizeMenuItem ${fontControlsOpen ? "is-active" : ""}`}
            onClick={() => setFontControlsOpen((current) => !current)}
            type="button"
          >
            <FontIcon />
            <span>Font</span>
          </button>
          <button
            aria-pressed={titleControlsOpen}
            className={`interactiveChart__customizeMenuItem ${titleControlsOpen ? "is-active" : ""}`}
            onClick={() => setTitleControlsOpen((current) => !current)}
            type="button"
          >
            <TitleIcon />
            <span>Title</span>
          </button>
          <button
            aria-pressed={axisControlsOpen}
            className={`interactiveChart__customizeMenuItem ${axisControlsOpen ? "is-active" : ""}`}
            onClick={() => setAxisControlsOpen((current) => !current)}
            type="button"
          >
            <AxisLabelsIcon />
            <span>Axis labels</span>
          </button>
          <button
            aria-pressed={legendControlsOpen}
            className={`interactiveChart__customizeMenuItem ${legendControlsOpen ? "is-active" : ""}`}
            onClick={() => setLegendControlsOpen((current) => !current)}
            type="button"
          >
            <LegendIcon />
            <span>Legend</span>
          </button>
          <button
            aria-pressed={tickControlsOpen}
            className={`interactiveChart__customizeMenuItem ${tickControlsOpen ? "is-active" : ""}`}
            onClick={() => setTickControlsOpen((current) => !current)}
            type="button"
          >
            <TickAxesIcon />
            <span>Ticks</span>
          </button>
        </div>
      ) : null}

      <div className="interactiveChart__gesturePanel">
        <div className="interactiveChart__gestureRow">
          <div className="interactiveChart__gestureIcons">
            <span className="interactiveChart__gestureIconWrap">
              <MouseClickIcon />
            </span>
            <span className="interactiveChart__gestureArrow" aria-hidden="true">
              →
            </span>
            <span className="interactiveChart__gestureIconWrap interactiveChart__gestureIconWrap--frame">
              <SelectionFrameIcon axis="x" />
            </span>
          </div>
          <span className="interactiveChart__gestureComma" aria-hidden="true">
            ,
          </span>
          <div className="interactiveChart__gestureIcons">
            <span className="interactiveChart__gestureKey">Shift</span>
            <span className="interactiveChart__gesturePlus" aria-hidden="true">
              +
            </span>
            <span className="interactiveChart__gestureIconWrap">
              <MouseClickIcon />
            </span>
            <span className="interactiveChart__gestureArrow" aria-hidden="true">
              →
            </span>
            <span className="interactiveChart__gestureIconWrap interactiveChart__gestureIconWrap--frame">
              <SelectionFrameIcon axis="y" />
            </span>
          </div>
        </div>
      </div>

      {styleControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>Style</span>
            <select
              className="interactiveChart__select"
              onChange={(event) => setChartStyle(event.target.value as ChartStyle)}
              title="Applies to every chart"
              value={chartStyle}
            >
              {(Object.keys(CHART_STYLE_LABELS) as ChartStyle[]).map((style) => (
                <option key={style} value={style}>
                  {CHART_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {pointSizeControlsOpen ? (
        <div className="interactiveChart__sliderBar">
          <label className="interactiveChart__sliderLabel">
            <span>Point size</span>
            <strong>{pointSize.toFixed(2)}</strong>
          </label>
          <input
            aria-label="Point size"
            className="interactiveChart__slider"
            max="5"
            min="0.05"
            onChange={(event) => setPointSize(Number(event.target.value))}
            step="0.05"
            type="range"
            value={pointSize}
          />
        </div>
      ) : null}

      {fontControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>Font</span>
            <select
              className="interactiveChart__select"
              onChange={(event) => setPickedFontFamily(event.target.value)}
              value={fontFamily}
            >
              {FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {titleControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>Title</span>
            <input
              className="interactiveChart__textInput"
              onChange={(event) => setChartTitle(event.target.value)}
              placeholder="Chart title"
              type="text"
              value={chartTitle}
            />
          </label>
          <label className="interactiveChart__sliderLabel">
            <span>Title font size</span>
            <strong>{chartTitleFontSize.toFixed(0)}</strong>
          </label>
          <input
            aria-label="Title font size"
            className="interactiveChart__slider"
            max="32"
            min="10"
            onChange={(event) =>
              setChartTitleFontSize(Number(event.target.value))
            }
            step="1"
            type="range"
            value={chartTitleFontSize}
          />
        </div>
      ) : null}

      {axisControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>x:</span>
            <input
              className="interactiveChart__textInput"
              onChange={(event) => setXAxisLabel(event.target.value)}
              placeholder="λ_0 (nm)"
              title="^ for superscript, _ for subscript; braces group: x^{-1}"
              type="text"
              value={xAxisLabel}
            />
          </label>
          <label className="interactiveChart__fieldRow">
            <span>y:</span>
            <input
              className="interactiveChart__textInput"
              onChange={(event) => setYAxisLabel(event.target.value)}
              placeholder="|E|^2 (a.u.)"
              title="^ for superscript, _ for subscript; braces group: x^{-1}"
              type="text"
              value={yAxisLabel}
            />
          </label>
          <label className="interactiveChart__sliderLabel">
            <span>Axis font size</span>
            <strong>{axisLabelFontSize.toFixed(0)}</strong>
          </label>
          <input
            aria-label="Axis label font size"
            className="interactiveChart__slider"
            max="24"
            min="8"
            onChange={(event) =>
              setAxisLabelFontSize(Number(event.target.value))
            }
            step="1"
            type="range"
            value={axisLabelFontSize}
          />
        </div>
      ) : null}

      {legendControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__sliderLabel">
            <span>Legend font size</span>
            <strong>{legendFontSize.toFixed(0)}</strong>
          </label>
          <input
            aria-label="Legend font size"
            className="interactiveChart__slider"
            max="24"
            min="8"
            onChange={(event) => setLegendFontSize(Number(event.target.value))}
            step="1"
            type="range"
            value={legendFontSize}
          />
        </div>
      ) : null}

      {tickControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>
              <i>x</i>: 10<sup>x</sup>
            </span>
            <input
              className="interactiveChart__textInput interactiveChart__textInput--mono"
              inputMode="numeric"
              onChange={(event) =>
                handleTickExponentChange("x", event.target.value)
              }
              step="1"
              type="number"
              value={xTickExponentDraft}
            />
          </label>
          <label className="interactiveChart__fieldRow">
            <span>
              <i>x</i> decimals
            </span>
            <input
              className="interactiveChart__textInput interactiveChart__textInput--mono"
              inputMode="numeric"
              onChange={(event) =>
                handleTickDecimalPlacesChange("x", event.target.value)
              }
              placeholder="auto"
              step="1"
              type="number"
              value={xTickDecimalPlacesDraft}
            />
          </label>
          <label className="interactiveChart__sliderLabel">
            <span>
              <i>x</i> tick font size
            </span>
            <strong>{xTickFontSize.toFixed(0)}</strong>
          </label>
          <input
            aria-label="X tick font size"
            className="interactiveChart__slider"
            max="24"
            min="8"
            onChange={(event) => setXTickFontSize(Number(event.target.value))}
            step="1"
            type="range"
            value={xTickFontSize}
          />
          <label className="interactiveChart__fieldRow">
            <span>
              <i>y</i>: 10<sup>x</sup>
            </span>
            <input
              className="interactiveChart__textInput interactiveChart__textInput--mono"
              inputMode="numeric"
              onChange={(event) =>
                handleTickExponentChange("y", event.target.value)
              }
              step="1"
              type="number"
              value={yTickExponentDraft}
            />
          </label>
          <label className="interactiveChart__fieldRow">
            <span>
              <i>y</i> decimals
            </span>
            <input
              className="interactiveChart__textInput interactiveChart__textInput--mono"
              inputMode="numeric"
              onChange={(event) =>
                handleTickDecimalPlacesChange("y", event.target.value)
              }
              placeholder="auto"
              step="1"
              type="number"
              value={yTickDecimalPlacesDraft}
            />
          </label>
          <label className="interactiveChart__sliderLabel">
            <span>
              <i>y</i> tick font size
            </span>
            <strong>{yTickFontSize.toFixed(0)}</strong>
          </label>
          <input
            aria-label="Y tick font size"
            className="interactiveChart__slider"
            max="24"
            min="8"
            onChange={(event) => setYTickFontSize(Number(event.target.value))}
            step="1"
            type="range"
            value={yTickFontSize}
          />
        </div>
      ) : null}

      {saveControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__checkboxRow">
            <input
              checked={saveHighQuality}
              onChange={(event) => setSaveHighQuality(event.target.checked)}
              type="checkbox"
            />
            <span>High quality</span>
          </label>
          <label className="interactiveChart__checkboxRow">
            <input
              checked={saveWhiteBackground}
              onChange={(event) => setSaveWhiteBackground(event.target.checked)}
              type="checkbox"
            />
            <span>White background</span>
          </label>
          <button
            className="interactiveChart__applyButton"
            onClick={handleSave}
            type="button"
          >
            Save PNG
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function InteractiveScatterChart(props: {
  data: ChartData<"scatter">;
  options: ChartOptions<"scatter">;
  sourceLabel?: string;
}) {
  const chartKey = useMemo(() => buildDataSignature(props.data), [props.data]);

  return <InteractiveScatterChartInner key={chartKey} {...props} />;
}
