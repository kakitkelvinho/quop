"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type FitsImageSummary = {
  height: number;
  max: number;
  min: number;
  pixels: Float32Array;
  width: number;
  xLabel: string;
  yLabel: string;
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatPixelValue(value: number) {
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  const absolute = Math.abs(value);

  if ((absolute >= 10000 || (absolute > 0 && absolute < 0.001))) {
    return value.toExponential(3);
  }

  return value.toFixed(4);
}

export default function FitsImageViewer({ summary }: { summary: FitsImageSummary }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverSample, setHoverSample] = useState<HoverSample | null>(null);
  const [colorMap, setColorMap] = useState<ColorMapName>("gray");

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    renderImagePreview(canvasRef.current, summary, colorMap);
  }, [colorMap, summary]);

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const x = clamp(Math.floor(((event.clientX - bounds.left) / bounds.width) * summary.width), 0, summary.width - 1);
    const y = clamp(Math.floor(((event.clientY - bounds.top) / bounds.height) * summary.height), 0, summary.height - 1);
    const value = summary.pixels[y * summary.width + x] ?? Number.NaN;

    setHoverSample({
      left: ((x + 0.5) / summary.width) * 100,
      top: ((y + 0.5) / summary.height) * 100,
      value,
      x,
      y,
    });
  }

  return (
    <div className="fitsImageFrame">
      <div className="fitsImageDisplay">
        <div className="fitsImageViewport">
          <canvas
            className="fitsImageCanvas"
            onPointerLeave={() => setHoverSample(null)}
            onPointerMove={handlePointerMove}
            ref={canvasRef}
          />
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
          <span className="fitsColorbar__label">{formatPixelValue(summary.max)}</span>
          <div
            className="fitsColorbar__scale"
            style={{ backgroundImage: buildColorBarGradient(colorMap) }}
          />
          <span className="fitsColorbar__label">{formatPixelValue(summary.min)}</span>
        </div>
      </div>
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
        {summary.width} × {summary.height} pixels. Axes: {summary.xLabel} / {summary.yLabel}.
      </p>
    </div>
  );
}
