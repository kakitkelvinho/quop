"use client";

import { useState } from "react";
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

import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Point = {
  x: number;
  y: number;
};

type ParseResult = {
  error: string | null;
  points: Point[];
  xCount: number;
  yCount: number;
};

const defaultX = "[0, 1, 2, 3, 4, 5, 6]";
const defaultY = "[0, 1, 4, 9, 16, 25, 36]";

function parseNumberArray(value: string): number[] {
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

function buildSeries(xInput: string, yInput: string): ParseResult {
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

const chartOptions: ChartOptions<"scatter"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: {
      type: "linear",
      title: { display: true, text: "x" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
    y: {
      title: { display: true, text: "y" },
      grid: { color: "rgba(91, 102, 117, 0.18)" },
    },
  },
  elements: {
    point: { radius: 3, hoverRadius: 5 },
    line: { tension: 0 },
  },
};

export default function ArrayPlotter() {
  const [xInput, setXInput] = useState(defaultX);
  const [yInput, setYInput] = useState(defaultY);

  const series = buildSeries(xInput, yInput);
  const chartData: ChartData<"scatter"> = {
    datasets: [
      {
        label: "Input series",
        data: series.points,
        showLine: true,
        borderWidth: 2,
        borderColor: "#8b1e3f",
        backgroundColor: "#8b1e3f",
      },
    ],
  };

  return (
    <div className="visualizerLayout">
      <div className="inputCard fieldStack">
        <div>
          <h2>Array Input</h2>
          <p className="lead">
            Paste JSON arrays like <code>[0, 1, 2]</code> or plain values like
            <code> 0, 1, 2</code>.
          </p>
        </div>

        <label className="field">
          <span>x values</span>
          <div className="field__control field__control--textarea">
            <textarea
              value={xInput}
              onChange={(event) => setXInput(event.target.value)}
              spellCheck={false}
              aria-label="x array input"
            />
          </div>
        </label>

        <label className="field">
          <span>y values</span>
          <div className="field__control field__control--textarea">
            <textarea
              value={yInput}
              onChange={(event) => setYInput(event.target.value)}
              spellCheck={false}
              aria-label="y array input"
            />
          </div>
        </label>

        <p className="resultCard">
          {series.error
            ? series.error
            : `Plotting ${series.points.length} points from ${series.xCount} x-values and ${series.yCount} y-values.`}
        </p>
      </div>

      <div className="sectionCard visualizerChartCard">
        <div>
          <p className="sectionCard__kicker">Chart.js</p>
          <h2>Data Plot</h2>
        </div>
        <div className="visualizerChartSurface">
          <InteractiveScatterChart data={chartData} options={chartOptions} />
          {series.error ? (
            <div className="visualizerEmptyState visualizerOverlayState">
              Fix the input arrays to render the figure.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
