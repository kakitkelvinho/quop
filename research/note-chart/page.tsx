"use client";

// Throwaway harness for kakitkelvinho/quop#300. Copied to
// src/app/research-note-chart/page.tsx for a build, never committed there.
// Three charts step through the same frames of note-sized data
// (3 series x 300 points); run.mjs drives them with window.__step().

import { useEffect, useMemo, useState } from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";

import InteractiveScatterChart from "@/components/plotters/interactive-scatter-chart";
import { LIGHT_SKIN, matplotlibFrame, TAB10 } from "@/components/plotters/matplotlib-skin";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

const SERIES = 3;
const POINTS = 300;

/** a frame whose amplitude changes, so its bounds (and the wrapper's key) change */
function movingFrame(k: number, labelled = true): ChartData<"scatter"> {
  return {
    datasets: Array.from({ length: SERIES }, (_, s) => ({
      ...(labelled ? { label: `series ${s + 1}` } : {}),
      showLine: true,
      pointRadius: 0,
      data: Array.from({ length: POINTS }, (_, i) => {
        const x = i / (POINTS - 1);
        return { x, y: (1 + 0.5 * k) * Math.sin(2 * Math.PI * (x + 0.1 * k + s / 3)) };
      }),
    })),
  };
}

/** standing waves pinned at both ends inside a fixed box: point count, bounds, first and last point never change */
function stableFrame(k: number): ChartData<"scatter"> {
  return {
    datasets: [
      ...Array.from({ length: SERIES }, (_, s) => ({
        label: `mode ${s + 1}`,
        showLine: true,
        pointRadius: 0,
        data: Array.from({ length: POINTS }, (_, i) => {
          const x = i / (POINTS - 1);
          // exact zeros at the ends: sin(n*pi) is ~1e-16, which would change the signature
          const y = i === 0 || i === POINTS - 1 ? 0 : Math.sin((s + 1) * Math.PI * x) * Math.cos(0.7 * k * (s + 1));
          return { x, y };
        }),
      })),
      { label: "box", showLine: false, pointRadius: 0, data: [{ x: 0, y: -1.2 }, { x: 1, y: 1.2 }] },
    ],
  };
}

export default function NoteChartHarness() {
  const [frame, setFrame] = useState(0);
  const [labelled, setLabelled] = useState(true);
  // ?only=isc|stable|bare renders one chart, so its costs can be timed alone
  const [only, setOnly] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.ChartJS = ChartJS;
    w.__step = (k: number) => setFrame(k);
    w.__setLabelled = (value: boolean) => setLabelled(value);
    setOnly(new URLSearchParams(window.location.search).get("only"));
  }, []);

  const moving = useMemo(() => movingFrame(frame), [frame]);
  const stable = useMemo(() => stableFrame(frame), [frame]);
  const bareData = useMemo(() => movingFrame(frame, labelled), [frame, labelled]);

  const iscOptions = useMemo<ChartOptions<"scatter">>(
    () => ({ plugins: { legend: { display: true } }, scales: { x: { type: "linear" }, y: { type: "linear" } } }),
    [],
  );

  // the lighter chart: same skin plugin and palette, fixed axes, no wrapper
  const bareOptions = useMemo<ChartOptions<"scatter">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeInOutCubic" },
      layout: { padding: { top: 6, right: 14, bottom: 4, left: 4 } },
      scales: {
        x: { type: "linear", min: 0, max: 1, grid: { display: false }, border: { display: false }, ticks: { padding: 6 }, title: { display: true, text: "x", color: "transparent" } },
        y: { type: "linear", min: -4, max: 4, grid: { display: false }, border: { display: false }, ticks: { padding: 6 }, title: { display: true, text: "y", color: "transparent" } },
      },
      plugins: {
        legend: { display: true, labels: { usePointStyle: true, boxHeight: 5 } },
        tooltip: { enabled: false },
        matplotlibFrame: { colors: LIGHT_SKIN, labels: { x: "x", y: "y" }, frame: true },
      },
    }),
    [],
  );
  const styledBare = useMemo<ChartData<"scatter">>(
    () => ({
      datasets: bareData.datasets.map((d, i) => ({ ...d, borderColor: TAB10[i], backgroundColor: TAB10[i], borderWidth: 1.5 })),
    }),
    [bareData],
  );

  return (
    <section className="pageSection">
      <h1>note chart harness</h1>
      <p id="frame">frame {frame}</p>
      {!only || only === "isc" ? (
        <div id="isc">
          <InteractiveScatterChart data={moving} options={iscOptions} />
        </div>
      ) : null}
      {!only || only === "stable" ? (
        <div id="isc-stable">
          <InteractiveScatterChart data={stable} options={iscOptions} />
        </div>
      ) : null}
      {!only || only === "bare" ? (
        <div id="bare" style={{ position: "relative", height: "22rem" }}>
          <Scatter data={styledBare} options={bareOptions} plugins={[matplotlibFrame]} />
        </div>
      ) : null}
    </section>
  );
}
