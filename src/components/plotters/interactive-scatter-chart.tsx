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

const DEFAULT_CHART_FONT_FAMILY = '"Trebuchet MS", Helvetica, sans-serif';
const FONT_OPTIONS = [
  { label: "Trebuchet MS", value: DEFAULT_CHART_FONT_FAMILY },
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

function formatTickValue(
  value: unknown,
  multiplier: number,
  decimalPlaces: number,
) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  const scaled = numeric * multiplier;

  if (scaled === 0) {
    return decimalPlaces > 0 ? (0).toFixed(decimalPlaces) : "0";
  }

  const absolute = Math.abs(scaled);

  if (absolute >= 1e5 || absolute < 1e-3) {
    return scaled.toExponential(decimalPlaces);
  }

  return scaled.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

function cloneScatterData(data: ChartData<"scatter">): ChartData<"scatter"> {
  return {
    ...data,
    datasets: data.datasets.map((dataset) => ({
      ...dataset,
      data: (dataset.data ?? []).map((entry) =>
        typeof entry === "object" && entry !== null ? { ...entry } : entry,
      ),
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
  const [joinedPoints, setJoinedPoints] = useState(() =>
    data.datasets.some((dataset) => dataset.showLine),
  );
  const defaultFontFamily =
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
    getFontFamily(options.scales?.y?.title?.font) ??
    DEFAULT_CHART_FONT_FAMILY;
  const [fontControlsOpen, setFontControlsOpen] = useState(false);
  const [fontFamily, setFontFamily] = useState(defaultFontFamily);
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
  const [xTickDecimalPlaces, setXTickDecimalPlaces] = useState(2);
  const [yTickDecimalPlaces, setYTickDecimalPlaces] = useState(2);
  const [xTickDecimalPlacesDraft, setXTickDecimalPlacesDraft] = useState("2");
  const [yTickDecimalPlacesDraft, setYTickDecimalPlacesDraft] = useState("2");
  const [xTickFontSize, setXTickFontSize] = useState(initialXTickFontSize);
  const [yTickFontSize, setYTickFontSize] = useState(initialYTickFontSize);
  const [saveControlsOpen, setSaveControlsOpen] = useState(false);
  const [saveHighQuality, setSaveHighQuality] = useState(true);
  const [saveWhiteBackground, setSaveWhiteBackground] = useState(true);
  const [saveBlackText, setSaveBlackText] = useState(true);
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

    if (!isWithinPlot && !isWithinYAxis) {
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

    if (activeSelection.axis === "pan-y") {
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

      if (draft.trim() === "") {
        return;
      }

      setXTickDecimalPlaces(
        parseIntegerDraft(draft, xTickDecimalPlaces, 0, 12),
      );
      return;
    }

    setYTickDecimalPlacesDraft(draft);

    if (draft.trim() === "") {
      return;
    }

    setYTickDecimalPlaces(parseIntegerDraft(draft, yTickDecimalPlaces, 0, 12));
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

    const exportTextColor = saveBlackText ? "#111827" : chartTextColor;
    const exportGridColor = saveBlackText
      ? "rgba(107, 114, 128, 0.32)"
      : chartGridColor;
    const exportData = cloneScatterData(chartData);
    const exportOptions: ChartOptions<"scatter"> = {
      ...mergedOptions,
      responsive: false,
      animation: false,
      color: exportTextColor,
      plugins: {
        ...mergedOptions.plugins,
        legend: mergedOptions.plugins?.legend
          ? {
              ...mergedOptions.plugins.legend,
              labels: {
                ...mergedOptions.plugins.legend.labels,
                color: exportTextColor,
              },
            }
          : mergedOptions.plugins?.legend,
        title: mergedOptions.plugins?.title
          ? {
              ...mergedOptions.plugins.title,
              color: exportTextColor,
            }
          : mergedOptions.plugins?.title,
        tooltip: mergedOptions.plugins?.tooltip
          ? {
              ...mergedOptions.plugins.tooltip,
              bodyColor: exportTextColor,
              titleColor: exportTextColor,
            }
          : mergedOptions.plugins?.tooltip,
      },
      scales: {
        ...mergedOptions.scales,
        x: {
          ...mergedOptions.scales?.x,
          grid: {
            ...mergedOptions.scales?.x?.grid,
            color: exportGridColor,
          },
          ticks: {
            ...mergedOptions.scales?.x?.ticks,
            color: exportTextColor,
          },
          title: {
            ...mergedOptions.scales?.x?.title,
            color: exportTextColor,
          },
        },
        y: {
          ...mergedOptions.scales?.y,
          grid: {
            ...mergedOptions.scales?.y?.grid,
            color: exportGridColor,
          },
          ticks: {
            ...mergedOptions.scales?.y?.ticks,
            color: exportTextColor,
          },
          title: {
            ...mergedOptions.scales?.y?.title,
            color: exportTextColor,
          },
        },
      },
    };

    const exportPlugins = saveWhiteBackground
      ? [
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
      : [];

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
  const chartTextColor = isDarkMode ? "#ebf1f7" : "#243244";
  const chartGridColor = isDarkMode
    ? "rgba(167, 182, 201, 0.18)"
    : "rgba(91, 102, 117, 0.18)";
  const chartData = useMemo<ChartData<"scatter">>(
    () => ({
      ...data,
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        pointHoverRadius: Math.max(pointSize + 1.5, pointSize * 1.5),
        pointRadius: pointSize,
        radius: pointSize,
        showLine: joinedPoints,
      })),
    }),
    [data, joinedPoints, pointSize],
  );
  const mergedOptions: ChartOptions<"scatter"> = {
    ...options,
    animation: dragSelection?.axis === "pan-y" ? false : options.animation,
    color: chartTextColor,
    font: {
      ...options.font,
      family: fontFamily,
    },
    plugins: {
      ...options.plugins,
      legend: options.plugins?.legend
        ? {
            ...options.plugins.legend,
            labels: {
              ...options.plugins.legend.labels,
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
        grid: {
          ...options.scales?.x?.grid,
          color: chartGridColor,
        },
        max: viewport.xMax,
        min: viewport.xMin,
        ticks: {
          ...options.scales?.x?.ticks,
          callback: (value) =>
            formatTickValue(value, xTickMultiplier, xTickDecimalPlaces),
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
          color: chartTextColor,
          display: Boolean(xAxisLabel),
          font: {
            ...options.scales?.x?.title?.font,
            family: fontFamily,
            size: axisLabelFontSize,
          },
          text: xAxisLabel,
        },
      },
      y: {
        ...options.scales?.y,
        grid: {
          ...options.scales?.y?.grid,
          color: chartGridColor,
        },
        max: viewport.yMax,
        min: viewport.yMin,
        ticks: {
          ...options.scales?.y?.ticks,
          callback: (value) =>
            formatTickValue(value, yTickMultiplier, yTickDecimalPlaces),
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
          color: chartTextColor,
          display: Boolean(yAxisLabel),
          font: {
            ...options.scales?.y?.title?.font,
            family: fontFamily,
            size: axisLabelFontSize,
          },
          text: yAxisLabel,
        },
      },
    },
  };

  return (
    <div className={`interactiveChart interactiveChart--${colorMode}`}>
      <div
        className="interactiveChart__stage"
        onPointerDown={handlePointerDown}
        onPointerLeave={clearDragSelection}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <Scatter data={chartData} options={mergedOptions} ref={chartRef} />
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
        <button
          aria-label={
            pointSizeControlsOpen
              ? "Hide point size slider"
              : "Show point size slider"
          }
          aria-pressed={pointSizeControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--size ${pointSizeControlsOpen ? "is-open" : ""}`}
          onClick={() => setPointSizeControlsOpen((current) => !current)}
          title="Point size"
          type="button"
        >
          <PointSizeIcon />
        </button>
        <button
          aria-label={
            fontControlsOpen ? "Hide font editor" : "Show font editor"
          }
          aria-pressed={fontControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--font ${fontControlsOpen ? "is-open" : ""}`}
          onClick={() => setFontControlsOpen((current) => !current)}
          title="Font"
          type="button"
        >
          <FontIcon />
        </button>
        <button
          aria-label={
            titleControlsOpen ? "Hide title editor" : "Show title editor"
          }
          aria-pressed={titleControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--title ${titleControlsOpen ? "is-open" : ""}`}
          onClick={() => setTitleControlsOpen((current) => !current)}
          title="Title"
          type="button"
        >
          <TitleIcon />
        </button>
        <button
          aria-label={
            axisControlsOpen
              ? "Hide axis label editor"
              : "Show axis label editor"
          }
          aria-pressed={axisControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--axis ${axisControlsOpen ? "is-open" : ""}`}
          onClick={() => setAxisControlsOpen((current) => !current)}
          title="Axis labels"
          type="button"
        >
          <AxisLabelsIcon />
        </button>
        <button
          aria-label={
            legendControlsOpen ? "Hide legend editor" : "Show legend editor"
          }
          aria-pressed={legendControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--legend ${legendControlsOpen ? "is-open" : ""}`}
          onClick={() => setLegendControlsOpen((current) => !current)}
          title="Legend"
          type="button"
        >
          <LegendIcon />
        </button>
        <button
          aria-label={
            tickControlsOpen ? "Hide tick editor" : "Show tick editor"
          }
          aria-pressed={tickControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--ticks ${tickControlsOpen ? "is-open" : ""}`}
          onClick={() => setTickControlsOpen((current) => !current)}
          title="Ticks"
          type="button"
        >
          <TickAxesIcon />
        </button>
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
              onChange={(event) => setFontFamily(event.target.value)}
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
              type="text"
              value={xAxisLabel}
            />
          </label>
          <label className="interactiveChart__fieldRow">
            <span>y:</span>
            <input
              className="interactiveChart__textInput"
              onChange={(event) => setYAxisLabel(event.target.value)}
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
          <label className="interactiveChart__checkboxRow">
            <input
              checked={saveBlackText}
              onChange={(event) => setSaveBlackText(event.target.checked)}
              type="checkbox"
            />
            <span>Black text</span>
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
