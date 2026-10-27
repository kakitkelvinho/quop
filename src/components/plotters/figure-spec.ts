// The scatter chart's figure: its state in, Chart.js data and options out.
// The only module that knows Chart.js's option shapes; the chart component
// (interactive-scatter-chart.tsx) keeps the state and the interaction, and
// its callers pass only what they decide (series, labels, legend, title,
// the x format). Kept free of React and next/font so it can be tested with
// node:test.

import type { ChartData, ChartOptions } from "chart.js";

import {
  CHART_STYLE_PALETTES,
  CLASSIC_DARK,
  CLASSIC_EXPORT,
  CLASSIC_LIGHT,
  type ChartStyle,
  type ClassicColors,
} from "./chart-style.ts";
import { clockTicks, formatClock, formatClockPoint } from "./clock-axis.ts";
import type { DataPoint } from "./csv-parsing.ts";
import { DARK_SKIN, LIGHT_SKIN, plainLabel, type SkinColors } from "./matplotlib-skin.ts";

export type Series = { label: string; points: DataPoint[] };

export type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

/**
 * How the legend marks each series: "points" with a dot, "boxes" with
 * Chart.js's coloured box. The matplotlib style always uses dots.
 */
export type LegendMarker = "points" | "boxes";

/**
 * How the x axis writes its values, when not as plain numbers. "clock":
 * a Clock column's times of day, ticked on whole minutes, hours, ...;
 * `seconds` when the readings fall between whole minutes, for the tooltip.
 */
export type XFormat = { kind: "clock"; seconds: boolean };

export type AxisTicks = {
  /** 10 to the power the user picked */
  multiplier: number;
  /** null: automatic, from the ticks on the axis */
  decimalPlaces: number | null;
  fontSize: number;
};

/** Everything the figure is drawn from, as the chart's toolbar sets it. */
export type FigureState = {
  style: ChartStyle;
  fontFamily: string;
  pointSize: number;
  joinedPoints: boolean;
  title: string;
  titleFontSize: number;
  xLabel: string;
  yLabel: string;
  axisLabelFontSize: number;
  /** null: no legend */
  legend: LegendMarker | null;
  legendFontSize: number;
  xTicks: AxisTicks;
  yTicks: AxisTicks;
  xFormat?: XFormat;
  viewport: Bounds;
  /** false: draw without animating, as while panning */
  animate: boolean;
};

/**
 * Where the figure is drawn: on screen, in the page's theme, or into an
 * exported file, which is always the light, paper-ready figure with every
 * pixel measure times `scale`.
 */
export type FigureTarget =
  | { kind: "screen"; theme: "light" | "dark" }
  | { kind: "export"; scale: number };

/** A file's name without its folders or extension: a chart's first title. */
export function titleFromFileName(fileName?: string) {
  if (!fileName) {
    return "";
  }

  const normalized = fileName.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.replace(/\.[^.]+$/, "");
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

export function formatTickValue(
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
      return scaled.toExponential().replace(/-/g, "−");
    }
    decimalPlaces = autoDecimalPlaces(written);
  }

  if (scaled === 0) {
    return decimalPlaces > 0 ? (0).toFixed(decimalPlaces) : "0";
  }

  const absolute = Math.abs(scaled);

  // a true minus sign, as matplotlib draws it, not a hyphen
  if (absolute >= 1e5 || absolute < 1e-3) {
    return scaled.toExponential(decimalPlaces).replace(/-/g, "−");
  }

  return scaled
    .toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })
    .replace(/-/g, "−");
}

// a clock axis's tick, with seconds when the ticks are less than a minute apart
export function formatClockTick(value: number, ticks: { value: number }[]) {
  return formatClock(value, ticks.length > 1 && ticks[1].value - ticks[0].value < 60);
}

function hoverRadius(pointSize: number) {
  return Math.max(pointSize + 1.5, pointSize * 1.5);
}

/** The colours a target draws in. */
function targetColors(state: FigureState, target: FigureTarget) {
  const isMatplotlib = state.style === "matplotlib";
  const dark = target.kind === "screen" && target.theme === "dark";
  const skin: SkinColors = dark ? DARK_SKIN : LIGHT_SKIN;
  const classic: ClassicColors =
    target.kind === "export" ? CLASSIC_EXPORT : dark ? CLASSIC_DARK : CLASSIC_LIGHT;

  return {
    dark,
    classic,
    /** the matplotlibFrame plugin's colours: the spines, or the Chart.js grid's */
    frame: isMatplotlib ? skin : { text: classic.text, frame: classic.grid },
    text: isMatplotlib ? skin.text : classic.text,
  };
}

/** The series, coloured by the style's cycle; an export's points are copies. */
export function figureData(
  series: Series[],
  state: Pick<FigureState, "style" | "pointSize" | "joinedPoints">,
  target: { kind: "screen" } | { kind: "export"; scale: number },
): ChartData<"scatter"> {
  const palette = CHART_STYLE_PALETTES[state.style];
  const scale = target.kind === "export" ? target.scale : 1;

  return {
    datasets: series.map(({ label, points }, index) => ({
      label,
      // a second chart, the export, must not share the screen's arrays
      data: target.kind === "export" ? points.map((point) => ({ ...point })) : points,
      borderColor: palette[index % palette.length],
      backgroundColor: palette[index % palette.length],
      // matplotlib's lines.linewidth
      borderWidth: (state.style === "matplotlib" ? 1.5 : 2) * scale,
      pointHoverRadius: hoverRadius(state.pointSize) * scale,
      pointRadius: state.pointSize * scale,
      radius: state.pointSize * scale,
      showLine: state.joinedPoints,
    })),
  };
}

/**
 * One axis in the chosen style. In both, the title is laid out as plain
 * text but painted by the matplotlibFrame plugin, which draws its ^ / _
 * markup.
 *
 * matplotlib: no grid and no Chart.js border or tick marks (the plugin
 * draws the spines and inward ticks), and labels close to the spine.
 * Chart.js: its own border, outward ticks and grid, in `classic.grid`.
 */
function axisOptions(
  state: FigureState,
  axis: "x" | "y",
  colors: ReturnType<typeof targetColors>,
  scale: number,
) {
  const label = axis === "x" ? state.xLabel : state.yLabel;
  const ticks = axis === "x" ? state.xTicks : state.yTicks;
  const clock = axis === "x" && state.xFormat?.kind === "clock";
  const viewport = state.viewport;
  const matplotlib = state.style === "matplotlib";

  return {
    min: axis === "x" ? viewport.xMin : viewport.yMin,
    max: axis === "x" ? viewport.xMax : viewport.yMax,
    grid: matplotlib ? { display: false } : { color: colors.classic.grid },
    border: matplotlib ? { display: false } : {},
    // a clock axis ticks on whole minutes, hours, ...
    ...(clock
      ? {
          afterBuildTicks: (scaleAxis: { min: number; max: number; ticks: { value: number }[] }) => {
            scaleAxis.ticks = clockTicks(scaleAxis.min, scaleAxis.max).map((value) => ({ value }));
          },
        }
      : {}),
    ticks: {
      ...(matplotlib ? { padding: 6 * scale } : {}),
      callback: (value: number | string, _index: number, axisTicks: { value: number }[]) =>
        clock
          ? formatClockTick(Number(value), axisTicks)
          : formatTickValue(value, ticks.multiplier, ticks.decimalPlaces, axisTicks),
      color: colors.text,
      font: { family: state.fontFamily, size: ticks.fontSize * scale },
      includeBounds: false,
    },
    title: {
      display: Boolean(label),
      color: "transparent",
      text: plainLabel(label),
      ...(matplotlib ? { padding: { top: 4 * scale, bottom: 4 * scale } } : {}),
      font: { family: state.fontFamily, size: state.axisLabelFontSize * scale },
    },
  };
}

/** The legend's swatches: matplotlib's dots, or the marker the chart asked for. */
function legendLabels(state: FigureState, scale: number) {
  const matplotlib = state.style === "matplotlib";
  const points = state.legend === "points";
  // swatch sizes scale with the text, or a point-style dot swamps its label
  return {
    ...(points || matplotlib ? { usePointStyle: true } : {}),
    ...(points ? { boxWidth: 10 * scale } : {}),
    ...(matplotlib ? { boxHeight: 5 * scale } : {}),
  };
}

export function figureOptions(state: FigureState, target: FigureTarget): ChartOptions<"scatter"> {
  const isMatplotlib = state.style === "matplotlib";
  const scale = target.kind === "export" ? target.scale : 1;
  const colors = targetColors(state, target);
  const family = state.fontFamily;
  const clock = state.xFormat?.kind === "clock" ? state.xFormat : null;

  return {
    responsive: target.kind === "screen",
    maintainAspectRatio: false,
    animation: target.kind === "screen" && state.animate ? undefined : false,
    color: colors.text,
    font: { family },
    // tight margins round the figure, as matplotlib's constrained layout leaves
    layout: isMatplotlib
      ? { padding: { top: 6 * scale, right: 14 * scale, bottom: 4 * scale, left: 4 * scale } }
      : undefined,
    plugins: {
      matplotlibFrame: {
        colors: colors.frame,
        labels: { x: state.xLabel, y: state.yLabel },
        ...(target.kind === "export" ? { scale } : {}),
        frame: isMatplotlib,
      },
      legend: state.legend
        ? {
            display: true,
            position: "top",
            labels: {
              ...legendLabels(state, scale),
              color: colors.text,
              font: { family, size: state.legendFontSize * scale },
            },
          }
        : { display: false },
      title: {
        display: Boolean(state.title),
        text: state.title,
        color: colors.text,
        font: {
          family,
          size: state.titleFontSize * scale,
          // matplotlib titles are set in the regular weight, Chart.js's in bold
          weight: isMatplotlib ? "normal" : "bold",
        },
      },
      tooltip: {
        enabled: true,
        ...(clock
          ? {
              callbacks: {
                label: (context) =>
                  formatClockPoint(context.dataset.label, context.parsed.x, context.parsed.y, clock.seconds),
              },
            }
          : {}),
        backgroundColor: colors.dark ? "rgba(15, 19, 28, 0.96)" : "rgba(255, 251, 245, 0.96)",
        bodyColor: colors.text,
        bodyFont: { family },
        borderColor: colors.dark ? "rgba(148, 163, 184, 0.35)" : "rgba(91, 102, 117, 0.22)",
        borderWidth: 1,
        titleColor: colors.text,
        titleFont: { family },
      },
    },
    elements: {
      point: {
        hoverRadius: hoverRadius(state.pointSize) * scale,
        radius: state.pointSize * scale,
      },
    },
    scales: {
      x: axisOptions(state, "x", colors, scale),
      y: axisOptions(state, "y", colors, scale),
    },
  };
}
