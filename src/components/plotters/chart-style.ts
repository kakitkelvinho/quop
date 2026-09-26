import { useSyncExternalStore } from "react";

import { MATPLOTLIB_FONT_FAMILY, TAB10 } from "@/components/plotters/matplotlib-skin";

// Which look the plotters draw in: the matplotlib skin (matplotlib-skin.ts)
// or the classic Chart.js one they had before it. One setting for every
// chart on the page, remembered in localStorage.

export type ChartStyle = "matplotlib" | "chartjs";

/**
 * The look a chart takes until someone picks one: Chart.js, since most plots
 * here are for looking at data; the matplotlib look is one click away for a
 * figure meant for a paper.
 */
export const DEFAULT_CHART_STYLE: ChartStyle = "chartjs";

export const CHART_STYLE_LABELS: Record<ChartStyle, string> = {
  matplotlib: "matplotlib",
  chartjs: "Chart.js",
};

export const CLASSIC_FONT_FAMILY = '"Trebuchet MS", Helvetica, sans-serif';

/** The plotters' colours before the matplotlib skin. */
const CLASSIC_PALETTE = ["#8b1e3f", "#1f6f78", "#d17a22", "#4a6d3b", "#5c4b8a"] as const;

/** Series colours, cycled by dataset index. */
export const CHART_STYLE_PALETTES: Record<ChartStyle, readonly string[]> = {
  matplotlib: TAB10,
  chartjs: CLASSIC_PALETTE,
};

/** The font a chart uses unless its plotter or its user picks another. */
export const CHART_STYLE_FONTS: Record<ChartStyle, string> = {
  matplotlib: MATPLOTLIB_FONT_FAMILY,
  chartjs: CLASSIC_FONT_FAMILY,
};

export type ClassicColors = { text: string; grid: string };

/** Chart.js text and grid lines: on screen per theme, and the export's darker set. */
export const CLASSIC_LIGHT: ClassicColors = { text: "#243244", grid: "rgba(91, 102, 117, 0.18)" };
export const CLASSIC_DARK: ClassicColors = { text: "#ebf1f7", grid: "rgba(167, 182, 201, 0.18)" };
export const CLASSIC_EXPORT: ClassicColors = { text: "#111827", grid: "rgba(107, 114, 128, 0.32)" };

// ---------------------------------------------------------------------------
// The shared setting
// ---------------------------------------------------------------------------

const STORAGE_KEY = "quop.plotters.chartStyle";
const listeners = new Set<() => void>();
/** the last pick, for when storage is blocked and it can only last until a reload */
let pickedStyle: ChartStyle | null = null;

function isChartStyle(value: unknown): value is ChartStyle {
  return value === "matplotlib" || value === "chartjs";
}

function getSnapshot(): ChartStyle {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChartStyle(stored) ? stored : DEFAULT_CHART_STYLE;
  } catch {
    return pickedStyle ?? DEFAULT_CHART_STYLE;
  }
}

function getServerSnapshot(): ChartStyle {
  return DEFAULT_CHART_STYLE;
}

/** Every chart on the page hears a change, and so do other tabs (`storage`). */
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setChartStyle(style: ChartStyle) {
  pickedStyle = style;
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // blocked storage: getSnapshot falls back to pickedStyle
  }
  listeners.forEach((listener) => listener());
}

export function useChartStyle(): ChartStyle {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
