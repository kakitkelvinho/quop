import localFont from "next/font/local";

import { CLASSIC_FONT_FAMILY, type ChartStyle } from "./chart-style.ts";
import type { PdfFont } from "./pdf-export.ts";
import { fontFamilyNames, type FontAliases } from "./svg-export.ts";

// The charts' web font, kept apart from the rest of the look: next/font only
// loads inside Next, and figure-spec.ts and its tests must load without it.

const cmuSerif = localFont({
  src: "./fonts/cmu-serif-500-roman.woff2",
  display: "swap",
  fallback: ["Latin Modern Roman", "Times New Roman", "serif"],
});

/** Computer Modern (CMU Serif), as a family string the canvas can use. */
export const MATPLOTLIB_FONT_FAMILY = cmuSerif.style.fontFamily;

// next/font's own names lead the stack: the web font, then the metric-matched fallback it generates
const [cmuWebFamily, cmuMetricFallback] = fontFamilyNames(MATPLOTLIB_FONT_FAMILY);

/** In a file those names mean nothing; the web font is CMU Serif, which a paper's machine may have. */
export const SVG_FONT_ALIASES: FontAliases = { [cmuWebFamily]: "CMU Serif", [cmuMetricFallback]: null };

/** A PDF carries the web font itself, under that same name. */
export const PDF_FONT: PdfFont = { family: "CMU Serif", webFamily: cmuWebFamily };

/** The font a chart uses unless its user picks another. */
export const CHART_STYLE_FONTS: Record<ChartStyle, string> = {
  matplotlib: MATPLOTLIB_FONT_FAMILY,
  chartjs: CLASSIC_FONT_FAMILY,
};
