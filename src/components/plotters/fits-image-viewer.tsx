"use client";

import { useEffect, useRef, useState } from "react";

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

function renderImagePreview(canvas: HTMLCanvasElement, summary: FitsImageSummary) {
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
      ? Math.max(0, Math.min(255, Math.round(((value - min) / span) * 255)))
      : 0;
    const pixelIndex = index * 4;

    imageData.data[pixelIndex] = normalized;
    imageData.data[pixelIndex + 1] = normalized;
    imageData.data[pixelIndex + 2] = normalized;
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

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    renderImagePreview(canvasRef.current, summary);
    setHoverSample(null);
  }, [summary]);

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
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
      <p className="fitsImageCaption">
        {summary.width} × {summary.height} pixels. Axes: {summary.xLabel} / {summary.yLabel}.
      </p>
    </div>
  );
}
