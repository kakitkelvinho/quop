"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import dynamic from "next/dynamic";
import { type ChartData, type ChartOptions } from "chart.js";

import {
  buildColorBarStops,
  COLOR_MAP_OPTIONS,
  COLOR_MAP_STOPS,
  renderColormappedFrame,
  type ColorMapName,
} from "@/components/plotters/colormaps";
import type {
  CameraPreset,
  SurfaceExport,
} from "@/components/plotters/fits-surface-view";
import {
  flipRow,
  normalizeViewport,
  pixelAtRatio,
  pixelAxisTicks,
  zoomViewport,
  type Viewport,
} from "@/components/plotters/image-axes";
import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import {
  clampPixelAspect,
  displayAspect,
  formatPixelAspect,
  pixelAspectSliderRange,
  squarePixelAspect,
  TRUE_PIXEL_ASPECT,
} from "@/components/plotters/pixel-aspect";
import { chooseSurfaceStep } from "@/components/plotters/surface-geometry";
import { useNumberDraft } from "@/components/use-number-draft";

// three.js loads only once someone opens the Surface view
const FitsSurfaceView = dynamic(() => import("@/components/plotters/fits-surface-view"), {
  ssr: false,
  loading: () => <div className="fitsSurfaceCanvas" />,
});

type FitsImageSummary = {
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  sourceLabel: string;
  width: number;
  xLabel: string;
  yLabel: string;
};

type DragSelection = {
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
};

type HoverSample = {
  left: number;
  top: number;
  value: number;
  x: number;
  y: number;
};

type SliceAxis = "horizontal" | "vertical";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function buildBaseViewport(summary: FitsImageSummary): Viewport {
  return {
    height: summary.height,
    left: 0,
    top: 0,
    width: summary.width,
  };
}

function renderViewport(
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  viewport: Viewport,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  // one canvas cell per pixel of the viewport, which covers whole pixels
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    sourceCanvas,
    viewport.left,
    viewport.top,
    viewport.width,
    viewport.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function formatPixelValue(value: number) {
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  const absolute = Math.abs(value);

  if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) {
    return value.toExponential(3);
  }

  return value.toFixed(4);
}

function getPointerDetails(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  summary: FitsImageSummary,
) {
  const bounds = canvas.getBoundingClientRect();
  const ratioX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const ratioY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
  const x = pixelAtRatio(ratioX, viewport.left, viewport.width, summary.width);
  // the viewport counts canvas rows from the top; the frame's row 0 is its bottom row
  const y = flipRow(
    pixelAtRatio(ratioY, viewport.top, viewport.height, summary.height),
    summary.height,
  );

  return {
    bounds,
    ratioX,
    ratioY,
    value: summary.pixels[y * summary.width + x] ?? Number.NaN,
    x,
    y,
  };
}

function buildSliceSeries(
  summary: FitsImageSummary,
  sliceAxis: SliceAxis,
  selectedRow: number,
  selectedColumn: number,
) {
  if (sliceAxis === "horizontal") {
    const row = clamp(selectedRow, 0, summary.height - 1);
    const points = Array.from({ length: summary.width }, (_, x) => ({
      x,
      y: summary.pixels[row * summary.width + x] ?? Number.NaN,
    }));

    return {
      axisLabel: summary.xLabel || "x",
      points,
      selectionLabel: `${summary.yLabel || "y"} = ${row}`,
    };
  }

  const column = clamp(selectedColumn, 0, summary.width - 1);
  const points = Array.from({ length: summary.height }, (_, y) => ({
    x: y,
    y: summary.pixels[y * summary.width + column] ?? Number.NaN,
  }));

  return {
    axisLabel: summary.yLabel || "y",
    points,
    selectionLabel: `${summary.xLabel || "x"} = ${column}`,
  };
}

function buildSliceBandStyle(
  viewport: Viewport,
  sliceAxis: SliceAxis,
  sliceIndex: number,
  summary: FitsImageSummary,
): CSSProperties | null {
  if (sliceAxis === "horizontal") {
    const canvasRow = flipRow(sliceIndex, summary.height);

    if (canvasRow < viewport.top || canvasRow >= viewport.top + viewport.height) {
      return null;
    }

    const top = ((canvasRow - viewport.top) / viewport.height) * 100;
    const height = Math.max(100 / viewport.height, 0.4);

    return {
      height: `${height}%`,
      insetInline: 0,
      top: `${top}%`,
    };
  }

  if (sliceIndex < viewport.left || sliceIndex >= viewport.left + viewport.width) {
    return null;
  }

  const left = ((sliceIndex - viewport.left) / viewport.width) * 100;
  const width = Math.max(100 / viewport.width, 0.4);

  return {
    bottom: 0,
    left: `${left}%`,
    top: 0,
    width: `${width}%`,
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

function SliceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 6.5h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 17.5h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M9 5v14" fill="none" stroke="currentColor" strokeDasharray="2.4 2.4" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SurfaceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M3.5 16.5 8 11l3 3 3.5-6.5L20.5 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M3.5 19.5h17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function AspectIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4.5" y="7" width="15" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 12h8M8 12l1.8-1.8M8 12l1.8 1.8M16 12l-1.8-1.8M16 12l-1.8 1.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** The Pixel aspect bar both views share: a log slider, an exact value, and the two presets. */
function PixelAspectControls({
  frameHeight,
  frameWidth,
  onChange,
  pixelAspect,
}: {
  frameHeight: number;
  frameWidth: number;
  onChange: (pixelAspect: number) => void;
  pixelAspect: number;
}) {
  const squareAspect = squarePixelAspect(frameWidth, frameHeight);
  const sliderRange = pixelAspectSliderRange(frameWidth, frameHeight);
  const exactField = useNumberDraft(
    Number(pixelAspect.toPrecision(4)),
    (typed) => {
      if (typed > 0) onChange(clampPixelAspect(typed));
    },
    { live: true },
  );

  return (
    <div className="interactiveChart__editorBar fitsAspectControls">
      <label className="interactiveChart__sliderLabel">
        <span>Pixel aspect (height ÷ width)</span>
        <strong>{formatPixelAspect(pixelAspect)}</strong>
      </label>
      {/* log scale: 1/2 and 2 sit the same distance either side of true pixels */}
      <input
        aria-label="Pixel aspect"
        className="interactiveChart__slider"
        max={sliderRange.max}
        min={sliderRange.min}
        onChange={(event) => onChange(2 ** Number(event.target.value))}
        step="0.01"
        type="range"
        value={Math.log2(pixelAspect)}
      />
      <div className="fitsAspectControls__row">
        <label className="interactiveChart__fieldRow">
          <span>Exact</span>
          <input
            aria-label="Pixel aspect value"
            className="interactiveChart__textInput"
            inputMode="decimal"
            min="0.001"
            step="0.05"
            type="number"
            {...exactField}
          />
        </label>
        <div className="fitsSurfaceControls__presets" role="group" aria-label="Pixel aspect presets">
          <button
            aria-pressed={pixelAspect === TRUE_PIXEL_ASPECT}
            className="interactiveChart__applyButton"
            onClick={() => onChange(TRUE_PIXEL_ASPECT)}
            title="Draw every pixel square (1 : 1)"
            type="button"
          >
            True pixels
          </button>
          <button
            aria-pressed={pixelAspect === squareAspect}
            className="interactiveChart__applyButton"
            onClick={() => onChange(squareAspect)}
            title={`Draw the whole frame as a square (pixel aspect ${formatPixelAspect(squareAspect)})`}
            type="button"
          >
            Square
          </button>
        </div>
      </div>
    </div>
  );
}

type ViewMode = "image" | "surface";

const CAMERA_PRESET_OPTIONS: Array<{ label: string; title: string; value: CameraPreset }> = [
  { label: "Reset", title: "Isometric view (reset camera)", value: "isometric" },
  { label: "Top", title: "Top-down, as the Image view", value: "top" },
  { label: "Side x", title: "Side-on, x across", value: "side-x" },
  { label: "Side y", title: "Side-on, y across", value: "side-y" },
];

function getDefaultTitleFromSourceLabel(sourceLabel: string) {
  const normalized = sourceLabel.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\.[^.]+$/, "");
}

function getExportFileName(title: string, xAxisLabel: string, yAxisLabel: string) {
  const baseName = (title || xAxisLabel || yAxisLabel || "fits-image")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return baseName || "fits-image";
}

function getRelativeRect(
  element: HTMLElement,
  containerRect: DOMRect,
  scaleFactor: number,
) {
  const rect = element.getBoundingClientRect();

  return {
    height: rect.height * scaleFactor,
    width: rect.width * scaleFactor,
    x: (rect.left - containerRect.left) * scaleFactor,
    y: (rect.top - containerRect.top) * scaleFactor,
  };
}

function buildSummarySignature(summary: FitsImageSummary) {
  return [
    summary.width,
    summary.height,
    summary.min,
    summary.max,
    summary.xLabel,
    summary.yLabel,
    summary.sourceLabel,
    summary.pixels.length,
    summary.pixels[0] ?? "",
    summary.pixels[summary.pixels.length - 1] ?? "",
  ].join("::");
}

function FitsImageViewerInner({ summary }: { summary: FitsImageSummary }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const xAxisRef = useRef<HTMLDivElement | null>(null);
  const yAxisRef = useRef<HTMLDivElement | null>(null);
  const colorbarScaleRef = useRef<HTMLDivElement | null>(null);
  const colorbarTopLabelRef = useRef<HTMLSpanElement | null>(null);
  const colorbarBottomLabelRef = useRef<HTMLSpanElement | null>(null);
  const [hoverSample, setHoverSample] = useState<HoverSample | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [colorMap, setColorMap] = useState<ColorMapName>("gray");
  const [viewport, setViewport] = useState<Viewport>(() => buildBaseViewport(summary));
  const [sliceControlsOpen, setSliceControlsOpen] = useState(false);
  const [sliceAxis, setSliceAxis] = useState<SliceAxis>("horizontal");
  const [selectedRow, setSelectedRow] = useState(() => Math.floor(summary.height / 2));
  const [selectedColumn, setSelectedColumn] = useState(() => Math.floor(summary.width / 2));
  const [titleControlsOpen, setTitleControlsOpen] = useState(false);
  const [chartTitle, setChartTitle] = useState(() =>
    getDefaultTitleFromSourceLabel(summary.sourceLabel),
  );
  const [chartTitleFontSize, setChartTitleFontSize] = useState(18);
  const [axisControlsOpen, setAxisControlsOpen] = useState(false);
  const [xAxisLabel, setXAxisLabel] = useState(summary.xLabel);
  const [yAxisLabel, setYAxisLabel] = useState(summary.yLabel);
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(14);
  const [saveControlsOpen, setSaveControlsOpen] = useState(false);
  const [saveWhiteBackground, setSaveWhiteBackground] = useState(true);
  const [saveBlackText, setSaveBlackText] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("image");
  const [exaggeration, setExaggeration] = useState(1);
  // shared by both views: how tall one pixel is drawn relative to its width
  const [pixelAspect, setPixelAspect] = useState(TRUE_PIXEL_ASPECT);
  const [aspectControlsOpen, setAspectControlsOpen] = useState(false);
  const [shading, setShading] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("isometric");
  const [cameraToken, setCameraToken] = useState(0);
  const surfaceHostRef = useRef<HTMLDivElement | null>(null);
  const surfaceExportRef = useRef<SurfaceExport | null>(null);

  useEffect(() => {
    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement("canvas");
    }

    renderColormappedFrame(sourceCanvasRef.current, summary, colorMap);
  }, [colorMap, summary]);

  useEffect(() => {
    if (!canvasRef.current || !sourceCanvasRef.current) {
      return;
    }

    renderViewport(canvasRef.current, sourceCanvasRef.current, viewport);
    // viewMode: the canvas remounts on the way back from the Surface view
  }, [colorMap, summary, viewport, viewMode]);

  function updateHoverSample(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextSample = getPointerDetails(event, canvas, viewport, summary);
    setHoverSample({
      left: nextSample.ratioX * 100,
      top: nextSample.ratioY * 100,
      value: nextSample.value,
      x: nextSample.x,
      y: nextSample.y,
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas || event.button !== 0) {
      return;
    }

    const nextSample = getPointerDetails(event, canvas, viewport, summary);
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    setDragSelection({
      currentX: nextSample.ratioX,
      currentY: nextSample.ratioY,
      startX: nextSample.ratioX,
      startY: nextSample.ratioY,
    });
    setHoverSample({
      left: nextSample.ratioX * 100,
      top: nextSample.ratioY * 100,
      value: nextSample.value,
      x: nextSample.x,
      y: nextSample.y,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    updateHoverSample(event);

    if (!dragSelection) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const nextSample = getPointerDetails(event, canvas, viewport, summary);
    setDragSelection((current) =>
      current
        ? {
            ...current,
            currentX: nextSample.ratioX,
            currentY: nextSample.ratioY,
          }
        : current,
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const activeSelection = dragSelection;

    if (!canvas || !activeSelection) {
      return;
    }

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    const nextSample = getPointerDetails(event, canvas, viewport, summary);
    const xDistance = Math.abs(nextSample.ratioX - activeSelection.startX) * nextSample.bounds.width;
    const yDistance = Math.abs(nextSample.ratioY - activeSelection.startY) * nextSample.bounds.height;

    setDragSelection(null);

    if (xDistance < 6 && yDistance < 6) {
      if (sliceAxis === "horizontal") {
        setSelectedRow(nextSample.y);
      } else {
        setSelectedColumn(nextSample.x);
      }

      return;
    }

    if (xDistance < 6 || yDistance < 6) {
      return;
    }

    const leftRatio = Math.min(activeSelection.startX, nextSample.ratioX);
    const rightRatio = Math.max(activeSelection.startX, nextSample.ratioX);
    const topRatio = Math.min(activeSelection.startY, nextSample.ratioY);
    const bottomRatio = Math.max(activeSelection.startY, nextSample.ratioY);
    const nextLeft = viewport.left + leftRatio * viewport.width;
    const nextTop = viewport.top + topRatio * viewport.height;
    const nextWidth = (rightRatio - leftRatio) * viewport.width;
    const nextHeight = (bottomRatio - topRatio) * viewport.height;

    setViewport(normalizeViewport(summary, nextLeft, nextTop, nextWidth, nextHeight));
  }

  function handlePointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    setDragSelection(null);
  }

  function zoomStep(factor: number) {
    setViewport((current) => zoomViewport(summary, current, factor));
  }

  function handleSaveSliceCsv() {
    const header = "x,y";
    const rows = sliceSeries.points.map((point) => `${point.x},${point.y}`);
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getExportFileName(chartTitle, xAxisLabel, yAxisLabel)}-${sliceAxis === "horizontal" ? `row-${activeRow}` : `column-${activeColumn}`}-slice.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSave() {
    // the plot rectangle: the flat canvas, or the Surface view's host
    const plotElement = viewMode === "surface" ? surfaceHostRef.current : canvasRef.current;
    const figure = figureRef.current;
    const sourceCanvas = sourceCanvasRef.current;

    if (!plotElement || !figure || !sourceCanvas) {
      return;
    }

    const figureRect = figure.getBoundingClientRect();

    if (figureRect.width <= 0 || figureRect.height <= 0) {
      return;
    }

    const scaleFactor = Math.max(3, Math.ceil(window.devicePixelRatio || 1));
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.max(1, Math.round(figureRect.width * scaleFactor));
    exportCanvas.height = Math.max(1, Math.round(figureRect.height * scaleFactor));

    const context = exportCanvas.getContext("2d");

    if (!context) {
      return;
    }

    if (saveWhiteBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    const exportTextColor = saveBlackText ? "#111827" : getComputedStyle(figure).color || "#243244";
    const borderColor = saveBlackText
      ? "rgba(55, 65, 81, 0.24)"
      : getComputedStyle(plotElement).borderColor || "rgba(91, 102, 117, 0.2)";
    const titleFontFamily = getComputedStyle(titleRef.current ?? figure).fontFamily || "sans-serif";
    const axisFontFamily = getComputedStyle(xAxisRef.current ?? figure).fontFamily || titleFontFamily;
    const labelFontFamily = getComputedStyle(colorbarTopLabelRef.current ?? figure).fontFamily || "monospace";
    const plotRect = getRelativeRect(plotElement, figureRect, scaleFactor);

    context.imageSmoothingEnabled = false;

    // tick labels and axis titles are HTML over the plot, so they are drawn
    // from their rects like the rest of the figure's chrome
    const drawPlotLabels = (labels: NodeListOf<HTMLElement>) => {
      labels.forEach((label) => {
        const labelRect = getRelativeRect(label, figureRect, scaleFactor);
        const labelStyle = getComputedStyle(label);
        context.fillStyle = saveBlackText ? exportTextColor : labelStyle.color;
        context.font = `${labelStyle.fontWeight} ${(parseFloat(labelStyle.fontSize) || 12) * scaleFactor}px ${labelStyle.fontFamily}`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
          label.textContent ?? "",
          labelRect.x + labelRect.width / 2,
          labelRect.y + labelRect.height / 2,
        );
      });
    };

    if (viewMode === "surface") {
      surfaceExportRef.current?.drawInto(context, plotRect, scaleFactor);
      drawPlotLabels(plotElement.querySelectorAll<HTMLElement>("[data-surface-label]"));
    } else {
      context.drawImage(
        sourceCanvas,
        viewport.left,
        viewport.top,
        viewport.width,
        viewport.height,
        plotRect.x,
        plotRect.y,
        plotRect.width,
        plotRect.height,
      );
      drawPlotLabels(figure.querySelectorAll<HTMLElement>("[data-axis-tick]"));
    }

    context.strokeStyle = borderColor;
    context.lineWidth = Math.max(1, scaleFactor);
    context.strokeRect(plotRect.x, plotRect.y, plotRect.width, plotRect.height);

    if (chartTitle && titleRef.current) {
      const titleRect = getRelativeRect(titleRef.current, figureRect, scaleFactor);
      context.fillStyle = exportTextColor;
      context.font = `800 ${chartTitleFontSize * scaleFactor}px ${titleFontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        chartTitle,
        titleRect.x + titleRect.width / 2,
        titleRect.y + titleRect.height / 2,
        Math.max(titleRect.width - 12 * scaleFactor, 0),
      );
    }

    if (xAxisLabel && xAxisRef.current) {
      const xAxisRect = getRelativeRect(xAxisRef.current, figureRect, scaleFactor);
      context.fillStyle = exportTextColor;
      context.font = `700 ${axisLabelFontSize * scaleFactor}px ${axisFontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        xAxisLabel,
        xAxisRect.x + xAxisRect.width / 2,
        xAxisRect.y + xAxisRect.height / 2,
        Math.max(xAxisRect.width - 12 * scaleFactor, 0),
      );
    }

    if (yAxisLabel && yAxisRef.current) {
      const yAxisRect = getRelativeRect(yAxisRef.current, figureRect, scaleFactor);
      context.save();
      context.translate(yAxisRect.x + yAxisRect.width / 2, yAxisRect.y + yAxisRect.height / 2);
      context.rotate(-Math.PI / 2);
      context.fillStyle = exportTextColor;
      context.font = `700 ${axisLabelFontSize * scaleFactor}px ${axisFontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        yAxisLabel,
        0,
        0,
        Math.max(yAxisRect.height - 12 * scaleFactor, 0),
      );
      context.restore();
    }

    if (colorbarScaleRef.current) {
      const scaleRect = getRelativeRect(colorbarScaleRef.current, figureRect, scaleFactor);
      // low to high, the way the colorbar runs on screen: up, or left to right on phones
      const gradient =
        scaleRect.width > scaleRect.height
          ? context.createLinearGradient(scaleRect.x, 0, scaleRect.x + scaleRect.width, 0)
          : context.createLinearGradient(0, scaleRect.y + scaleRect.height, 0, scaleRect.y);
      const colorStops = COLOR_MAP_STOPS[colorMap];

      colorStops.forEach((stop, index) => {
        gradient.addColorStop(index / Math.max(colorStops.length - 1, 1), `rgb(${stop[0]} ${stop[1]} ${stop[2]})`);
      });

      context.fillStyle = gradient;
      context.fillRect(scaleRect.x, scaleRect.y, scaleRect.width, scaleRect.height);
      context.strokeStyle = borderColor;
      context.strokeRect(scaleRect.x, scaleRect.y, scaleRect.width, scaleRect.height);
    }

    const colorbarLabelFontSize =
      parseFloat(getComputedStyle(colorbarTopLabelRef.current ?? figure).fontSize) || 12;

    context.fillStyle = exportTextColor;
    context.font = `700 ${colorbarLabelFontSize * scaleFactor}px ${labelFontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    if (colorbarTopLabelRef.current) {
      const topRect = getRelativeRect(colorbarTopLabelRef.current, figureRect, scaleFactor);
      context.fillText(
        formatPixelValue(summary.max),
        topRect.x + topRect.width / 2,
        topRect.y + topRect.height / 2,
        Math.max(topRect.width - 8 * scaleFactor, 0),
      );
    }

    if (colorbarBottomLabelRef.current) {
      const bottomRect = getRelativeRect(colorbarBottomLabelRef.current, figureRect, scaleFactor);
      context.fillText(
        formatPixelValue(summary.min),
        bottomRect.x + bottomRect.width / 2,
        bottomRect.y + bottomRect.height / 2,
        Math.max(bottomRect.width - 8 * scaleFactor, 0),
      );
    }

    const imageUrl = exportCanvas.toDataURL("image/png");

    if (!imageUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${getExportFileName(chartTitle, xAxisLabel, yAxisLabel)}.png`;
    link.click();
  }

  const canShowSurface = summary.width >= 2 && summary.height >= 2;
  const isSurface = viewMode === "surface" && canShowSurface;
  const surfaceStep = chooseSurfaceStep(summary.width, summary.height);  const baseViewport = buildBaseViewport(summary);
  const isZoomed =
    viewport.left !== baseViewport.left ||
    viewport.top !== baseViewport.top ||
    viewport.width !== baseViewport.width ||
    viewport.height !== baseViewport.height;
  const activeRow = clamp(selectedRow, 0, summary.height - 1);
  const activeColumn = clamp(selectedColumn, 0, summary.width - 1);
  const activeSliceIndex = sliceAxis === "horizontal" ? activeRow : activeColumn;
  const rowField = useNumberDraft(
    activeRow,
    (typed) => setSelectedRow(clamp(Math.trunc(typed), 0, Math.max(summary.height - 1, 0))),
    { live: true },
  );
  const columnField = useNumberDraft(
    activeColumn,
    (typed) => setSelectedColumn(clamp(Math.trunc(typed), 0, Math.max(summary.width - 1, 0))),
    { live: true },
  );
  const sliceBandStyle = buildSliceBandStyle(viewport, sliceAxis, activeSliceIndex, summary);
  // the longer side of the shown region gets the most ticks
  const shownAspect = displayAspect(viewport.width, viewport.height, pixelAspect);
  const xTicks = pixelAxisTicks(
    viewport.left,
    viewport.width,
    Math.max(2, Math.round(5 * Math.min(shownAspect, 1))),
  );
  // the viewport counts canvas rows from the top; the ticks count frame rows from the bottom
  const yTicks = pixelAxisTicks(
    summary.height - viewport.top - viewport.height,
    viewport.height,
    Math.max(2, Math.round(5 * Math.min(1 / shownAspect, 1))),
  );
  const selectionStyle = dragSelection
    ? {
        height: `${Math.abs(dragSelection.currentY - dragSelection.startY) * 100}%`,
        left: `${Math.min(dragSelection.startX, dragSelection.currentX) * 100}%`,
        top: `${Math.min(dragSelection.startY, dragSelection.currentY) * 100}%`,
        width: `${Math.abs(dragSelection.currentX - dragSelection.startX) * 100}%`,
      }
    : null;
  const sliceSeries = useMemo(
    () => buildSliceSeries(summary, sliceAxis, activeRow, activeColumn),
    [activeColumn, activeRow, sliceAxis, summary],
  );
  const sliceChartData: ChartData<"scatter"> = useMemo(
    () => ({
      datasets: [
        {
          label: sliceSeries.selectionLabel,
          data: sliceSeries.points,
          parsing: false,
          showLine: true,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2,
        },
      ],
    }),
    [sliceSeries],
  );
  const sliceChartOptions: ChartOptions<"scatter"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: sliceSeries.selectionLabel,
        },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: sliceSeries.axisLabel,
          },
          grid: { color: "rgba(91, 102, 117, 0.16)" },
        },
        y: {
          title: {
            display: true,
            text: "Intensity",
          },
          grid: { color: "rgba(91, 102, 117, 0.16)" },
        },
      },
      elements: {
        line: { tension: 0 },
        point: { radius: 0, hoverRadius: 3 },
      },
    }),
    [sliceSeries.axisLabel, sliceSeries.selectionLabel],
  );

  return (
    <div className="fitsImageFrame">
      <div className="fitsImageFigure" ref={figureRef}>
        {chartTitle ? (
          <div
            className="fitsImageFigure__title"
            ref={titleRef}
            style={{ fontSize: `${chartTitleFontSize}px` }}
          >
            {chartTitle}
          </div>
        ) : null}
        <div className="fitsImageFigure__body">
          {isSurface ? (
            // the Surface view labels its axes in the scene; this keeps the grid's columns
            <div aria-hidden="true" className="fitsImageFigure__axis fitsImageFigure__axis--y" />
          ) : yAxisLabel ? (
            <div className="fitsImageFigure__axis fitsImageFigure__axis--y" ref={yAxisRef}>
              <span className="fitsImageFigure__axisLabel fitsImageFigure__axisLabel--y" style={{ fontSize: `${axisLabelFontSize}px` }}>
                {yAxisLabel}
              </span>
            </div>
          ) : null}
          <div className={`fitsImageViewport${isSurface ? "" : " fitsImageViewport--ticked"}`}>
            {isSurface ? (
              <div className="fitsSurfaceHost" ref={surfaceHostRef}>
                <FitsSurfaceView
                  cameraPreset={cameraPreset}
                  cameraToken={cameraToken}
                  colorMap={colorMap}
                  exaggeration={exaggeration}
                  exportRef={surfaceExportRef}
                  frame={summary}
                  pixelAspect={pixelAspect}
                  shading={shading}
                  slice={sliceControlsOpen ? { axis: sliceAxis, index: activeSliceIndex } : null}
                  valueLabel="value"
                  xLabel={xAxisLabel}
                  yLabel={yAxisLabel}
                />
              </div>
            ) : (
            <div
              className="fitsImageViewport__surface"
              // the box takes the shown region's shape at the pixel aspect; the
              // canvas fills it, so overlays and pointer maths share its edges
              style={{ "--fits-aspect": displayAspect(viewport.width, viewport.height, pixelAspect) } as CSSProperties}
            >
              <canvas
                className="fitsImageCanvas"
                onPointerCancel={handlePointerCancel}
                onPointerDown={handlePointerDown}
                onPointerLeave={() => {
                  if (!dragSelection) {
                    setHoverSample(null);
                  }
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                ref={canvasRef}
              />
              {sliceControlsOpen && sliceBandStyle ? (
                <div
                  className={`fitsSliceBand fitsSliceBand--${sliceAxis}`}
                  style={sliceBandStyle}
                />
              ) : null}
              {selectionStyle ? (
                <div className="interactiveChart__selection fitsImageViewport__selection" style={selectionStyle} />
              ) : null}
              {hoverSample ? (
                <>
                  <div className="fitsCrosshair fitsCrosshair--vertical" style={{ left: `${hoverSample.left}%` }} />
                  <div className="fitsCrosshair fitsCrosshair--horizontal" style={{ top: `${hoverSample.top}%` }} />
                  <div
                    className="fitsCrosshairBox"
                    style={{
                      left: `${hoverSample.left}%`,
                      top: `${hoverSample.top}%`,
                    }}
                  />
                  <div className="fitsReadout">
                    <span>x {hoverSample.x}</span>
                    <span>y {hoverSample.y}</span>
                    <span>value {formatPixelValue(hoverSample.value)}</span>
                  </div>
                </>
              ) : null}
              <div aria-hidden="true" className="fitsImageTicks">
                {xTicks.map((tick) => (
                  <span
                    className="fitsImageTick fitsImageTick--x"
                    data-axis-tick=""
                    key={`x${tick}`}
                    style={{ left: `${((tick + 0.5 - viewport.left) / viewport.width) * 100}%` }}
                  >
                    {tick}
                  </span>
                ))}
                {yTicks.map((tick) => (
                  <span
                    className="fitsImageTick fitsImageTick--y"
                    data-axis-tick=""
                    key={`y${tick}`}
                    style={{
                      top: `${((flipRow(tick, summary.height) + 0.5 - viewport.top) / viewport.height) * 100}%`,
                    }}
                  >
                    {tick}
                  </span>
                ))}
              </div>
            </div>
            )}
          </div>
          <div className="fitsColorbar" role="group" aria-label="Colorbar intensity scale">
            <span className="fitsColorbar__label" ref={colorbarTopLabelRef}>
              {formatPixelValue(summary.max)}
            </span>
            <div
              aria-hidden="true"
              className="fitsColorbar__scale"
              ref={colorbarScaleRef}
              style={{ "--colorbar-stops": buildColorBarStops(colorMap) } as CSSProperties}
            />
            <span className="fitsColorbar__label" ref={colorbarBottomLabelRef}>
              {formatPixelValue(summary.min)}
            </span>
          </div>
        </div>
        {xAxisLabel && !isSurface ? (
          <div
            className="fitsImageFigure__axis fitsImageFigure__axis--x"
            ref={xAxisRef}
            style={{ fontSize: `${axisLabelFontSize}px` }}
          >
            {xAxisLabel}
          </div>
        ) : null}
      </div>

      <div className="interactiveChart__footer">
        <button
          aria-label={isSurface ? "Show the Image view" : "Show the Surface view"}
          aria-pressed={isSurface}
          className={`interactiveChart__iconButton ${isSurface ? "is-active" : ""}`}
          disabled={!canShowSurface}
          onClick={() => {
            setViewMode(isSurface ? "image" : "surface");
            setHoverSample(null);
            setDragSelection(null);
          }}
          title={
            canShowSurface
              ? isSurface
                ? "Image view"
                : "Surface view (3D)"
              : "The Surface view needs a frame of at least 2 × 2 pixels"
          }
          type="button"
        >
          <SurfaceIcon />
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        {isSurface ? null : (
        <>
        <button
          aria-label="Reset zoom"
          className={`interactiveChart__iconButton ${isZoomed ? "is-active" : ""}`}
          onClick={() => {
            setViewport(baseViewport);
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
          onClick={() => zoomStep(0.8)}
          title="Zoom in"
          type="button"
        >
          <ZoomInIcon />
        </button>
        <button
          aria-label="Zoom out"
          className="interactiveChart__iconButton"
          onClick={() => zoomStep(1.25)}
          title="Zoom out"
          type="button"
        >
          <ZoomOutIcon />
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        </>
        )}
        <button
          aria-label={titleControlsOpen ? "Hide title editor" : "Show title editor"}
          aria-pressed={titleControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--title ${titleControlsOpen ? "is-open" : ""}`}
          onClick={() => setTitleControlsOpen((current) => !current)}
          title="Title"
          type="button"
        >
          <TitleIcon />
        </button>
        <button
          aria-label={axisControlsOpen ? "Hide axis label editor" : "Show axis label editor"}
          aria-pressed={axisControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--axis ${axisControlsOpen ? "is-open" : ""}`}
          onClick={() => setAxisControlsOpen((current) => !current)}
          title="Axis labels"
          type="button"
        >
          <AxisLabelsIcon />
        </button>
        <button
          aria-label={aspectControlsOpen ? "Hide pixel aspect controls" : "Show pixel aspect controls"}
          aria-pressed={aspectControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--aspect ${aspectControlsOpen ? "is-open" : ""}`}
          onClick={() => setAspectControlsOpen((current) => !current)}
          title="Pixel aspect"
          type="button"
        >
          <AspectIcon />
        </button>
        <button
          aria-label={sliceControlsOpen ? "Hide slice tools" : "Show slice tools"}
          aria-pressed={sliceControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--slice ${sliceControlsOpen ? "is-open" : ""}`}
          onClick={() => setSliceControlsOpen((current) => !current)}
          title="Slice tools"
          type="button"
        >
          <SliceIcon />
        </button>
        <span aria-hidden="true" className="interactiveChart__footerDivider" />
        <button
          aria-label={saveControlsOpen ? "Hide save options" : "Show save options"}
          aria-pressed={saveControlsOpen}
          className={`interactiveChart__iconButton interactiveChart__iconButton--save ${saveControlsOpen ? "is-open" : ""}`}
          onClick={() => setSaveControlsOpen((current) => !current)}
          title="Save"
          type="button"
        >
          <SaveIcon />
        </button>
      </div>

      {isSurface ? (
        <div className="interactiveChart__editorBar fitsSurfaceControls">
          <label className="interactiveChart__sliderLabel">
            <span>Exaggeration</span>
            <strong>{exaggeration.toFixed(1)}×</strong>
          </label>
          <input
            aria-label="Elevation exaggeration"
            className="interactiveChart__slider"
            max="4"
            min="0.1"
            onChange={(event) => setExaggeration(Number(event.target.value))}
            step="0.1"
            type="range"
            value={exaggeration}
          />
          <label className="interactiveChart__checkboxRow">
            <input checked={shading} onChange={(event) => setShading(event.target.checked)} type="checkbox" />
            <span>Shading</span>
          </label>
          <div className="fitsSurfaceControls__presets" role="group" aria-label="Camera">
            {CAMERA_PRESET_OPTIONS.map((option) => (
              <button
                className="interactiveChart__applyButton"
                key={option.value}
                onClick={() => {
                  setCameraPreset(option.value);
                  setCameraToken((current) => current + 1);
                }}
                title={option.title}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {aspectControlsOpen ? (
        <PixelAspectControls
          frameHeight={summary.height}
          frameWidth={summary.width}
          onChange={setPixelAspect}
          pixelAspect={pixelAspect}
        />
      ) : null}

      {titleControlsOpen ? (
        <div className="interactiveChart__editorBar">
          <label className="interactiveChart__fieldRow">
            <span>Title</span>
            <input
              className="interactiveChart__textInput"
              onChange={(event) => setChartTitle(event.target.value)}
              placeholder="Image title"
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
            onChange={(event) => setChartTitleFontSize(Number(event.target.value))}
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
            onChange={(event) => setAxisLabelFontSize(Number(event.target.value))}
            step="1"
            type="range"
            value={axisLabelFontSize}
          />
        </div>
      ) : null}

      {saveControlsOpen ? (
        <div className="interactiveChart__editorBar">
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
            <span>Dark text</span>
          </label>
          <button className="interactiveChart__applyButton" onClick={handleSave} type="button">
            Save PNG
          </button>
        </div>
      ) : null}

      {sliceControlsOpen ? (
        <>
          <div className="fitsInspectorGrid">
            <section className="fitsInspectorCard">
              <div className="fitsInspectorCard__header">
                <p className="sectionCard__kicker">Slice</p>
                <h3>1D intensity plot</h3>
              </div>
              <div className="fitsSliceControls">
                <label className="fitsColorControl fitsColorControl--compact">
                  <span>Direction</span>
                  <select
                    className="fitsColorControl__select"
                    onChange={(event) => setSliceAxis(event.target.value as SliceAxis)}
                    value={sliceAxis}
                  >
                    <option value="horizontal">Horizontal slice (pick y)</option>
                    <option value="vertical">Vertical slice (pick x)</option>
                  </select>
                </label>
                {sliceAxis === "horizontal" ? (
                  <label className="field fitsSliceControls__field">
                    <span>y index</span>
                    <div className="field__control">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={Math.max(summary.height - 1, 0)}
                        step="1"
                        {...rowField}
                      />
                      <span>px</span>
                    </div>
                  </label>
                ) : (
                  <label className="field fitsSliceControls__field">
                    <span>x index</span>
                    <div className="field__control">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={Math.max(summary.width - 1, 0)}
                        step="1"
                        {...columnField}
                      />
                      <span>px</span>
                    </div>
                  </label>
                )}
              </div>
              <input
                aria-label={sliceAxis === "horizontal" ? "Slice row" : "Slice column"}
                className="interactiveChart__slider"
                max={Math.max((sliceAxis === "horizontal" ? summary.height : summary.width) - 1, 0)}
                min="0"
                onChange={(event) =>
                  sliceAxis === "horizontal"
                    ? setSelectedRow(Number(event.target.value))
                    : setSelectedColumn(Number(event.target.value))
                }
                step="1"
                type="range"
                value={activeSliceIndex}
              />
              <p className="fitsInspectorCard__meta">
                {isSurface
                  ? `Move the slider to sweep the Slice plane through the landscape; its yellow line matches the trace below.`
                  : `Click the image to snap the active ${sliceAxis === "horizontal" ? "row" : "column"} to the hovered location. The highlighted band on the image matches the trace below.`}
              </p>
              <button
                className="buttonControl buttonControl--secondary fitsInspectorCard__button"
                onClick={handleSaveSliceCsv}
                type="button"
              >
                <span className="buttonControl__title">Save slice CSV</span>
                <span className="buttonControl__meta">Export the active slice as x,y columns</span>
              </button>
            </section>
          </div>

          <section className="fitsSlicePanel">
            <div className="fitsSlicePanel__header">
              <div>
                <p className="sectionCard__kicker">Slice Plot</p>
                <h3>{sliceSeries.selectionLabel}</h3>
              </div>
              <p className="fitsSlicePanel__meta">
                Intensity plotted against {sliceSeries.axisLabel} for the full {sliceAxis === "horizontal" ? "row" : "column"}.
              </p>
            </div>
            <div className="fitsSlicePanel__chart">
              <InteractiveScatterChart
                data={sliceChartData}
                options={sliceChartOptions}
                sourceLabel={`${summary.sourceLabel}-${sliceSeries.selectionLabel}`}
              />
            </div>
          </section>
        </>
      ) : null}

      <label className="fitsColorControl">
        <span>Colormap</span>
        <select
          className="fitsColorControl__select"
          onChange={(event) => {
            setColorMap(event.target.value as ColorMapName);
            setHoverSample(null);
          }}
          value={colorMap}
        >
          {COLOR_MAP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="fitsImageCaption">
        {summary.width} × {summary.height} pixels. Original axes: {summary.xLabel} / {summary.yLabel}.
        {isSurface
          ? `${surfaceStep > 1 ? ` Surface mesh at 1/${surfaceStep} resolution (peaks kept); colour and hover use every pixel.` : ""} Drag to orbit, scroll to zoom, right-drag to pan.`
          : null}
      </p>
    </div>
  );
}

export default function FitsImageViewer({ summary }: { summary: FitsImageSummary }) {
  return <FitsImageViewerInner key={buildSummarySignature(summary)} summary={summary} />;
}
