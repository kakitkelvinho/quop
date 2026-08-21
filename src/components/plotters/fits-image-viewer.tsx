"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

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

type Viewport = {
  height: number;
  left: number;
  top: number;
  width: number;
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

type ColorMapName = "gray" | "viridis" | "plasma" | "inferno" | "magma";

const COLOR_MAP_OPTIONS: Array<{ label: string; value: ColorMapName }> = [
  { label: "Gray", value: "gray" },
  { label: "Viridis", value: "viridis" },
  { label: "Plasma", value: "plasma" },
  { label: "Inferno", value: "inferno" },
  { label: "Magma", value: "magma" },
];

const COLOR_MAP_STOPS: Record<ColorMapName, Array<[number, number, number]>> = {
  gray: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 97],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [84, 3, 160],
    [182, 54, 121],
    [251, 136, 97],
    [240, 249, 33],
  ],
  inferno: [
    [0, 0, 4],
    [87, 15, 109],
    [187, 55, 84],
    [249, 142, 8],
    [252, 255, 164],
  ],
  magma: [
    [0, 0, 4],
    [72, 20, 103],
    [149, 52, 110],
    [221, 95, 75],
    [252, 253, 191],
  ],
};

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

function normalizeViewport(
  summary: FitsImageSummary,
  left: number,
  top: number,
  width: number,
  height: number,
): Viewport {
  const nextWidth = clamp(width, 1, summary.width);
  const nextHeight = clamp(height, 1, summary.height);

  return {
    height: nextHeight,
    left: clamp(left, 0, summary.width - nextWidth),
    top: clamp(top, 0, summary.height - nextHeight),
    width: nextWidth,
  };
}

function interpolateColor(colorMap: ColorMapName, normalized: number) {
  const stops = COLOR_MAP_STOPS[colorMap];

  if (stops.length === 1) {
    return stops[0];
  }

  const clamped = Math.min(Math.max(normalized, 0), 1);
  const scaled = clamped * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const blend = scaled - lowerIndex;
  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];

  return [0, 1, 2].map((channel) =>
    Math.round(lower[channel] + (upper[channel] - lower[channel]) * blend),
  ) as [number, number, number];
}

function buildColorBarGradient(colorMap: ColorMapName) {
  const stops = COLOR_MAP_STOPS[colorMap];

  return `linear-gradient(to top, ${stops
    .map((stop, index) => {
      const position = (index / Math.max(stops.length - 1, 1)) * 100;
      return `rgb(${stop[0]} ${stop[1]} ${stop[2]}) ${position}%`;
    })
    .join(", ")})`;
}

function renderImagePreview(
  canvas: HTMLCanvasElement,
  summary: FitsImageSummary,
  colorMap: ColorMapName,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height, pixels, min, max } = summary;
  const imageData = context.createImageData(width, height);
  const span = max - min || 1;

  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index];
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(1, (value - min) / span))
      : 0;
    const pixelIndex = index * 4;
    const [red, green, blue] = interpolateColor(colorMap, normalized);

    imageData.data[pixelIndex] = red;
    imageData.data[pixelIndex + 1] = green;
    imageData.data[pixelIndex + 2] = blue;
    imageData.data[pixelIndex + 3] = 255;
  }

  canvas.width = width;
  canvas.height = height;
  context.putImageData(imageData, 0, 0);
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

  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
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
  const x = clamp(
    Math.floor(viewport.left + ratioX * Math.max(viewport.width - 1, 0)),
    0,
    summary.width - 1,
  );
  const y = clamp(
    Math.floor(viewport.top + ratioY * Math.max(viewport.height - 1, 0)),
    0,
    summary.height - 1,
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

  useEffect(() => {
    if (!sourceCanvasRef.current) {
      sourceCanvasRef.current = document.createElement("canvas");
    }

    renderImagePreview(sourceCanvasRef.current, summary, colorMap);
  }, [colorMap, summary]);

  useEffect(() => {
    if (!canvasRef.current || !sourceCanvasRef.current) {
      return;
    }

    renderViewport(canvasRef.current, sourceCanvasRef.current, viewport);
  }, [colorMap, summary, viewport]);

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

  function handleSave() {
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    const sourceCanvas = sourceCanvasRef.current;

    if (!canvas || !figure || !sourceCanvas) {
      return;
    }

    const figureRect = figure.getBoundingClientRect();

    if (figureRect.width <= 0 || figureRect.height <= 0) {
      return;
    }

    const scaleFactor = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
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
      : getComputedStyle(canvas).borderColor || "rgba(91, 102, 117, 0.2)";
    const titleFontFamily = getComputedStyle(titleRef.current ?? figure).fontFamily || "sans-serif";
    const axisFontFamily = getComputedStyle(xAxisRef.current ?? figure).fontFamily || titleFontFamily;
    const labelFontFamily = getComputedStyle(colorbarTopLabelRef.current ?? figure).fontFamily || "monospace";
    const canvasRect = getRelativeRect(canvas, figureRect, scaleFactor);

    context.imageSmoothingEnabled = false;
    context.drawImage(
      sourceCanvas,
      viewport.left,
      viewport.top,
      viewport.width,
      viewport.height,
      canvasRect.x,
      canvasRect.y,
      canvasRect.width,
      canvasRect.height,
    );
    context.strokeStyle = borderColor;
    context.lineWidth = Math.max(1, scaleFactor);
    context.strokeRect(canvasRect.x, canvasRect.y, canvasRect.width, canvasRect.height);

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
      const gradient = context.createLinearGradient(0, scaleRect.y + scaleRect.height, 0, scaleRect.y);
      const colorStops = COLOR_MAP_STOPS[colorMap];

      colorStops.forEach((stop, index) => {
        gradient.addColorStop(index / Math.max(colorStops.length - 1, 1), `rgb(${stop[0]} ${stop[1]} ${stop[2]})`);
      });

      context.fillStyle = gradient;
      context.fillRect(scaleRect.x, scaleRect.y, scaleRect.width, scaleRect.height);
      context.strokeStyle = borderColor;
      context.strokeRect(scaleRect.x, scaleRect.y, scaleRect.width, scaleRect.height);
    }

    context.fillStyle = exportTextColor;
    context.font = `700 ${Math.max(12, 12 * scaleFactor)}px ${labelFontFamily}`;
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

  const baseViewport = buildBaseViewport(summary);
  const isZoomed =
    viewport.left !== baseViewport.left ||
    viewport.top !== baseViewport.top ||
    viewport.width !== baseViewport.width ||
    viewport.height !== baseViewport.height;
  const selectionStyle = dragSelection
    ? {
        height: `${Math.abs(dragSelection.currentY - dragSelection.startY) * 100}%`,
        left: `${Math.min(dragSelection.startX, dragSelection.currentX) * 100}%`,
        top: `${Math.min(dragSelection.startY, dragSelection.currentY) * 100}%`,
        width: `${Math.abs(dragSelection.currentX - dragSelection.startX) * 100}%`,
      }
    : null;

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
          {yAxisLabel ? (
            <div className="fitsImageFigure__axis fitsImageFigure__axis--y" ref={yAxisRef}>
              <span className="fitsImageFigure__axisLabel fitsImageFigure__axisLabel--y" style={{ fontSize: `${axisLabelFontSize}px` }}>
                {yAxisLabel}
              </span>
            </div>
          ) : null}
          <div className="fitsImageViewport">
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
          </div>
          <div className="fitsColorbar" aria-hidden="true">
            <span className="fitsColorbar__label" ref={colorbarTopLabelRef}>
              {formatPixelValue(summary.max)}
            </span>
            <div
              className="fitsColorbar__scale"
              ref={colorbarScaleRef}
              style={{ backgroundImage: buildColorBarGradient(colorMap) }}
            />
            <span className="fitsColorbar__label" ref={colorbarBottomLabelRef}>
              {formatPixelValue(summary.min)}
            </span>
          </div>
        </div>
        {xAxisLabel ? (
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
      </p>
    </div>
  );
}

export default function FitsImageViewer({ summary }: { summary: FitsImageSummary }) {
  return <FitsImageViewerInner key={buildSummarySignature(summary)} summary={summary} />;
}
