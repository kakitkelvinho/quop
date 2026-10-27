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
  type ChartConfiguration,
} from "chart.js";

import {
  AxisLabelsIcon,
  CustomizeIcon,
  FontIcon,
  JoinDotsIcon,
  LegendIcon,
  PointSizeIcon,
  ResetZoomIcon,
  SaveIcon,
  ScrollIcon,
  StyleIcon,
  ThemeIcon,
  TickAxesIcon,
  TitleIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/plotters/chart-icons";
import { CHART_STYLE_FONTS, MATPLOTLIB_FONT_FAMILY, PDF_FONT, SVG_FONT_ALIASES } from "@/components/plotters/chart-fonts";
import {
  CHART_STYLE_LABELS,
  CLASSIC_FONT_FAMILY,
  setChartStyle,
  useChartStyle,
} from "@/components/plotters/chart-style";
import {
  figureData,
  figureOptions,
  type Bounds,
  type FigureState,
  type FigureTarget,
  type LegendMarker,
  type Series,
  type XFormat,
} from "@/components/plotters/figure-spec";
import { matplotlibFrame } from "@/components/plotters/matplotlib-skin";
import { renderChartPdf } from "@/components/plotters/pdf-export";
import { renderChartSvg } from "@/components/plotters/svg-export";
import { ChartInfo, DragGesture, ToolGesture } from "@/components/plotters/chart-info";
import { SignIcon } from "@/components/sign-icon";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

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

function downloadUrl(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
}

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

function getTickMultiplierFromExponent(exponent: number) {
  return 10 ** exponent;
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

function extractFinitePoints(series: Series[]) {
  const points: Array<{ x: number; y: number }> = [];

  for (const { points: entries } of series) {
    for (const entry of entries) {
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

function buildBaseBounds(series: Series[]): Bounds {
  const points = extractFinitePoints(series);

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

function buildDataSignature(series: Series[]) {
  const points = extractFinitePoints(series);
  const baseBounds = buildBaseBounds(series);
  const datasetSummary = series
    .map(({ label, points: entries }, index) => {
      const first = entries[0];
      const last = entries[entries.length - 1];

      return [
        index,
        label,
        entries.length,
        first ? `${Number(first.x)}:${Number(first.y)}` : "",
        last ? `${Number(last.x)}:${Number(last.y)}` : "",
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

export type InteractiveScatterChartProps = {
  series: Series[];
  /** the axis labels it starts with; the toolbar can change them */
  xLabel: string;
  yLabel: string;
  /** omitted: no legend */
  legend?: LegendMarker;
  /** the title it starts with; omitted, none */
  title?: string;
  /** writes the x axis as something other than plain numbers (a Clock column) */
  xFormat?: XFormat;
  /** the point size it starts with */
  pointSize?: number;
  /** false: never animate, for a chart redrawn as a slider moves or too big to animate */
  animate?: boolean;
};

function InteractiveScatterChartInner({
  series,
  xLabel: initialXAxisLabel,
  yLabel: initialYAxisLabel,
  legend,
  title: initialChartTitle = "",
  xFormat,
  pointSize: initialPointSize = 3,
  animate = true,
}: InteractiveScatterChartProps) {
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
  const [joinedPoints, setJoinedPoints] = useState(true);
  const [fontControlsOpen, setFontControlsOpen] = useState(false);
  // a font picked here wins over the style's, in either style
  const [pickedFontFamily, setPickedFontFamily] = useState<string | undefined>(undefined);
  const fontFamily = pickedFontFamily ?? CHART_STYLE_FONTS[chartStyle];
  const [pointSizeControlsOpen, setPointSizeControlsOpen] = useState(false);
  const [pointSize, setPointSize] = useState(initialPointSize);
  const [titleControlsOpen, setTitleControlsOpen] = useState(false);
  const [chartTitle, setChartTitle] = useState(initialChartTitle);
  const [chartTitleFontSize, setChartTitleFontSize] = useState(18);
  const [axisControlsOpen, setAxisControlsOpen] = useState(false);
  const [xAxisLabel, setXAxisLabel] = useState(initialXAxisLabel);
  const [yAxisLabel, setYAxisLabel] = useState(initialYAxisLabel);
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(14);
  const [legendControlsOpen, setLegendControlsOpen] = useState(false);
  const [legendFontSize, setLegendFontSize] = useState(12);
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
  const [xTickFontSize, setXTickFontSize] = useState(12);
  const [yTickFontSize, setYTickFontSize] = useState(12);
  const [saveControlsOpen, setSaveControlsOpen] = useState(false);
  const [saveHighQuality, setSaveHighQuality] = useState(true);
  const [saveWhiteBackground, setSaveWhiteBackground] = useState(true);
  const [customizeMenuOpen, setCustomizeMenuOpen] = useState(false);
  const anyCustomizeControlOpen =
    pointSizeControlsOpen ||
    fontControlsOpen ||
    titleControlsOpen ||
    axisControlsOpen ||
    legendControlsOpen ||
    tickControlsOpen;
  const baseBounds = useMemo(() => buildBaseBounds(series), [series]);
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

  /** The chart as an export draws it, every pixel measure times `scaleFactor`. */
  function buildExportConfig(scaleFactor: number): ChartConfiguration<"scatter"> {
    const target: FigureTarget = { kind: "export", scale: scaleFactor };
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

    return {
      type: "scatter",
      data: figureData(series, figureState, target),
      options: figureOptions(figureState, target),
      plugins: exportPlugins,
    };
  }

  function handleSave() {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const scaleFactor = saveHighQuality ? 3 : 1;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.max(1, Math.round(chart.width * scaleFactor));
    exportCanvas.height = Math.max(1, Math.round(chart.height * scaleFactor));
    const exportChart = new ChartJS(exportCanvas, buildExportConfig(scaleFactor));

    try {
      const imageUrl = exportChart.toBase64Image("image/png", 1);

      if (!imageUrl) {
        return;
      }

      downloadUrl(imageUrl, `${getExportFileName()}${saveHighQuality ? "-hq" : ""}.png`);
    } finally {
      exportChart.destroy();
    }
  }

  async function handleSaveSvg() {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const svg = await renderChartSvg(buildExportConfig(1), chart.width, chart.height, SVG_FONT_ALIASES);
    downloadUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `${getExportFileName()}.svg`);
  }

  async function handleSavePdf() {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const svg = await renderChartSvg(buildExportConfig(1), chart.width, chart.height, SVG_FONT_ALIASES);
    downloadUrl(await renderChartPdf(svg, chart.width, chart.height, PDF_FONT), `${getExportFileName()}.pdf`);
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

  const figureState: FigureState = {
    style: chartStyle,
    fontFamily,
    pointSize,
    joinedPoints,
    title: chartTitle,
    titleFontSize: chartTitleFontSize,
    xLabel: xAxisLabel,
    yLabel: yAxisLabel,
    axisLabelFontSize,
    legend: legend ?? null,
    legendFontSize,
    xTicks: { multiplier: xTickMultiplier, decimalPlaces: xTickDecimalPlaces, fontSize: xTickFontSize },
    yTicks: { multiplier: yTickMultiplier, decimalPlaces: yTickDecimalPlaces, fontSize: yTickFontSize },
    xFormat,
    viewport,
    // panning redraws on every move: animating each would lag behind the pointer
    animate: animate && dragSelection?.axis !== "pan-y" && dragSelection?.axis !== "pan-x",
  };
  const chartData = useMemo(
    () => figureData(series, { style: chartStyle, pointSize, joinedPoints }, { kind: "screen" }),
    [chartStyle, series, joinedPoints, pointSize],
  );
  const chartOptions = figureOptions(figureState, { kind: "screen", theme: colorMode });

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
          options={chartOptions}
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
          <SignIcon>
            <ResetZoomIcon />
          </SignIcon>
        </button>
        <button
          aria-label="Zoom in"
          className="interactiveChart__iconButton"
          onClick={() => zoomBoth(0.8)}
          title="Zoom in"
          type="button"
        >
          <SignIcon>
            <ZoomInIcon />
          </SignIcon>
        </button>
        <button
          aria-label="Zoom out"
          className="interactiveChart__iconButton"
          onClick={() => zoomBoth(1.25)}
          title="Zoom out"
          type="button"
        >
          <SignIcon>
            <ZoomOutIcon />
          </SignIcon>
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
          <SignIcon>
            <ScrollIcon />
          </SignIcon>
        </button>
        <button
          aria-label={joinedPoints ? "Show points only" : "Join points"}
          aria-pressed={joinedPoints}
          className={`interactiveChart__iconButton interactiveChart__iconButton--join ${joinedPoints ? "is-joined" : ""}`}
          onClick={() => setJoinedPoints((current) => !current)}
          title={joinedPoints ? "Lines on" : "Lines off"}
          type="button"
        >
          <SignIcon>
            <JoinDotsIcon />
          </SignIcon>
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        <button
          aria-expanded={customizeMenuOpen}
          aria-label={
            customizeMenuOpen ? "Hide customize menu" : "Show customize menu"
          }
          className={`interactiveChart__iconButton interactiveChart__iconButton--customize ${customizeMenuOpen || anyCustomizeControlOpen ? "is-active" : ""}`}
          onClick={() => setCustomizeMenuOpen((current) => !current)}
          title="Customize"
          type="button"
        >
          <SignIcon>
            <CustomizeIcon />
          </SignIcon>
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        {/* one click flips every chart on the page between the two looks */}
        <button
          aria-label={
            isMatplotlib
              ? "Switch all charts to the Chart.js style"
              : "Switch all charts to the matplotlib style"
          }
          aria-pressed={isMatplotlib}
          className={`interactiveChart__iconButton ${isMatplotlib ? "is-active" : ""}`}
          onClick={() => setChartStyle(isMatplotlib ? "chartjs" : "matplotlib")}
          title={
            isMatplotlib
              ? `${CHART_STYLE_LABELS.matplotlib} style (all charts)`
              : `${CHART_STYLE_LABELS.chartjs} style (all charts)`
          }
          type="button"
        >
          <SignIcon>
            <StyleIcon />
          </SignIcon>
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
          <SignIcon>
            <ThemeIcon />
          </SignIcon>
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
          <SignIcon>
            <SaveIcon />
          </SignIcon>
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        <ChartInfo
          hints={[
            {
              gesture: <DragGesture axis="x" />,
              text: <><strong>Drag</strong>: horizontal windowing.</>,
            },
            {
              gesture: <DragGesture axis="y" shift />,
              text: <><strong>Shift + drag</strong>: vertical windowing.</>,
            },
            {
              gesture: (
                <ToolGesture>
                  <ResetZoomIcon />
                </ToolGesture>
              ),
              text: <><strong>Reset zoom</strong> to go back.</>,
            },
          ]}
          title="Windowing"
        />
      </div>

      {customizeMenuOpen ? (
        <div className="interactiveChart__customizeMenu">
          <button
            aria-pressed={pointSizeControlsOpen}
            className={`interactiveChart__customizeMenuItem ${pointSizeControlsOpen ? "is-active" : ""}`}
            onClick={() => setPointSizeControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <PointSizeIcon />
            </SignIcon>
            <span>Point size</span>
          </button>
          <button
            aria-pressed={fontControlsOpen}
            className={`interactiveChart__customizeMenuItem ${fontControlsOpen ? "is-active" : ""}`}
            onClick={() => setFontControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <FontIcon />
            </SignIcon>
            <span>Font</span>
          </button>
          <button
            aria-pressed={titleControlsOpen}
            className={`interactiveChart__customizeMenuItem ${titleControlsOpen ? "is-active" : ""}`}
            onClick={() => setTitleControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <TitleIcon />
            </SignIcon>
            <span>Title</span>
          </button>
          <button
            aria-pressed={axisControlsOpen}
            className={`interactiveChart__customizeMenuItem ${axisControlsOpen ? "is-active" : ""}`}
            onClick={() => setAxisControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <AxisLabelsIcon />
            </SignIcon>
            <span>Axis labels</span>
          </button>
          <button
            aria-pressed={legendControlsOpen}
            className={`interactiveChart__customizeMenuItem ${legendControlsOpen ? "is-active" : ""}`}
            onClick={() => setLegendControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <LegendIcon />
            </SignIcon>
            <span>Legend</span>
          </button>
          <button
            aria-pressed={tickControlsOpen}
            className={`interactiveChart__customizeMenuItem ${tickControlsOpen ? "is-active" : ""}`}
            onClick={() => setTickControlsOpen((current) => !current)}
            type="button"
          >
            <SignIcon>
              <TickAxesIcon />
            </SignIcon>
            <span>Ticks</span>
          </button>
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
              title="^ sup · _ sub · {} group"
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
              title="^ sup · _ sub · {} group"
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
          <button
            className="interactiveChart__applyButton"
            onClick={handleSaveSvg}
            type="button"
          >
            Save SVG
          </button>
          <button
            className="interactiveChart__applyButton"
            onClick={handleSavePdf}
            type="button"
          >
            Save PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function InteractiveScatterChart(props: InteractiveScatterChartProps) {
  const chartKey = useMemo(() => buildDataSignature(props.series), [props.series]);

  return <InteractiveScatterChartInner key={chartKey} {...props} />;
}
