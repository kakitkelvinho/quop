import { TAB10 } from "@/components/plotters/matplotlib-skin";

/** Series colours: matplotlib's tab10 cycle (see matplotlib-skin.ts). */
export const CHART_SERIES_PALETTE = TAB10.map((color) => ({
  border: color,
  background: color,
}));
