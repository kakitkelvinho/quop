"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
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

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type DragSelection = {
  currentX: number;
  startX: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function extractFinitePoints(data: ChartData<"scatter">) {
  const points: Array<{ x: number; y: number }> = [];

  for (const dataset of data.datasets) {
    for (const entry of dataset.data ?? []) {
      if (typeof entry !== "object" || entry === null || !("x" in entry) || !("y" in entry)) {
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

  if (nextMax - nextMin < minimumRange) {
    const center = (nextMin + nextMax) / 2;

    return {
      yMin: center - minimumRange / 2,
      yMax: center + minimumRange / 2,
    };
  }

  return { yMin: nextMin, yMax: nextMax };
}

function getCanvasPoint(chart: ChartJS<"scatter">, clientX: number, clientY: number) {
  const rect = chart.canvas.getBoundingClientRect();

  return {
    x: ((clientX - rect.left) / rect.width) * chart.width,
    y: ((clientY - rect.top) / rect.height) * chart.height,
  };
}

export default function InteractiveScatterChart({
  data,
  options,
}: {
  data: ChartData<"scatter">;
  options: ChartOptions<"scatter">;
}) {
  const chartRef = useRef<ChartJS<"scatter"> | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState(true);
  const baseBounds = useMemo(() => buildBaseBounds(data), [data]);
  const [viewport, setViewport] = useState<Bounds>(baseBounds);

  useEffect(() => {
    setViewport(baseBounds);
    setDragSelection(null);
  }, [baseBounds]);

  function zoomX(factor: number) {
    setViewport((current) => {
      const center = (current.xMin + current.xMax) / 2;
      const halfRange = ((current.xMax - current.xMin) * factor) / 2;
      const next = normalizeXBounds(baseBounds, center - halfRange, center + halfRange);

      return { ...current, ...next };
    });
  }

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

  function panX(direction: -1 | 1) {
    setViewport((current) => {
      const range = current.xMax - current.xMin;
      const shift = range * 0.18 * direction;
      const next = normalizeXBounds(baseBounds, current.xMin + shift, current.xMax + shift);

      return { ...current, ...next };
    });
  }


  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart) {
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

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragSelection({ startX: point.x, currentX: point.x });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const chart = chartRef.current;

    if (!chart || !dragSelection) {
      return;
    }

    const point = getCanvasPoint(chart, event.clientX, event.clientY);
    const chartArea = chart.chartArea;

    setDragSelection({
      ...dragSelection,
      currentX: clamp(point.x, chartArea.left, chartArea.right),
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

    const startX = dragSelection.startX;
    const endX = dragSelection.currentX;
    setDragSelection(null);

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

  const chartArea = chartRef.current?.chartArea;
  const selectionStyle = dragSelection && chartArea
    ? {
        left: `${(Math.min(dragSelection.startX, dragSelection.currentX) / chartRef.current!.width) * 100}%`,
        width: `${(Math.abs(dragSelection.currentX - dragSelection.startX) / chartRef.current!.width) * 100}%`,
        top: `${(chartArea.top / chartRef.current!.height) * 100}%`,
        height: `${((chartArea.bottom - chartArea.top) / chartRef.current!.height) * 100}%`,
      }
    : null;

  const mergedOptions: ChartOptions<"scatter"> = {
    ...options,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      ...options.scales,
      x: {
        ...options.scales?.x,
        min: viewport.xMin,
        max: viewport.xMax,
      },
      y: {
        ...options.scales?.y,
        min: viewport.yMin,
        max: viewport.yMax,
      },
    },
  };

  return (
    <div className="interactiveChart">
      <div className="interactiveChart__toolbar">
        <div className="interactiveChart__controls">
          <button className="interactiveChart__button" onClick={() => zoomX(0.75)} type="button">X+</button>
          <button className="interactiveChart__button" onClick={() => zoomX(1.35)} type="button">X-</button>
          <button className="interactiveChart__button" onClick={() => panX(-1)} type="button">←</button>
          <button className="interactiveChart__button" onClick={() => panX(1)} type="button">→</button>
          <button
            aria-pressed={scrollZoomEnabled}
            className={`interactiveChart__button interactiveChart__button--toggle ${scrollZoomEnabled ? "is-active" : ""}`}
            onClick={() => setScrollZoomEnabled((current) => !current)}
            type="button"
          >
            Scroll: {scrollZoomEnabled ? "on" : "off"}
          </button>
        </div>
      </div>

      <div
        className="interactiveChart__stage"
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setDragSelection(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <Scatter data={data} options={mergedOptions} ref={chartRef} />
        {selectionStyle ? <div className="interactiveChart__selection" style={selectionStyle} /> : null}
      </div>

      <div className="interactiveChart__footer">
        <button className="interactiveChart__reset" onClick={() => setViewport(baseBounds)} type="button">
          Reset zoom
        </button>
      </div>
    </div>
  );
}
