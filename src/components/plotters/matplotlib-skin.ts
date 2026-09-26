import localFont from "next/font/local";
import type { CartesianScaleOptions, Chart, ChartType, FontSpec, Plugin, Scale, TRBL } from "chart.js";
import { toFont, toPadding } from "chart.js/helpers";

// The plotters' shared look: matplotlib's defaults, drawn over Chart.js. A
// boxed frame with inward ticks on all four spines (major and minor), the
// Computer Modern serif, the tab10 colour cycle, no grid, and axis labels
// that take a light ^ / _ markup for super- and subscripts.

const cmuSerif = localFont({
  src: "./fonts/cmu-serif-500-roman.woff2",
  display: "swap",
  fallback: ["Latin Modern Roman", "Times New Roman", "serif"],
});

/** Computer Modern (CMU Serif), as a family string the canvas can use. */
export const MATPLOTLIB_FONT_FAMILY = cmuSerif.style.fontFamily;

/** matplotlib's default colour cycle, `tab10`. */
export const TAB10 = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
] as const;

export type SkinColors = { text: string; frame: string };

/** Light is the paper figure, and what every export renders in. */
export const LIGHT_SKIN: SkinColors = { text: "#000000", frame: "#000000" };
export const DARK_SKIN: SkinColors = { text: "#e6e6e6", frame: "#cfcfcf" };

// matplotlib's rcParams in points at 100 dpi, rounded to CSS pixels
const SPINE_WIDTH_PX = 1;
const MAJOR_TICK_PX = 5;
const MINOR_TICK_PX = 3;
const MAJOR_TICK_WIDTH_PX = 1;
const MINOR_TICK_WIDTH_PX = 0.8;
const SCRIPT_SCALE = 0.7;

// ---------------------------------------------------------------------------
// Label markup
// ---------------------------------------------------------------------------

export type LabelRun = { text: string; shift: -1 | 0 | 1 };

/**
 * Split a label into runs: `x^2` and `x^{-1}` are superscripts, `λ_0` and
 * `T_{max}` subscripts. A backslash escapes the next character, so `\^` is
 * a literal caret. Anything else is plain text.
 */
export function parseLabelMarkup(source: string): LabelRun[] {
  const runs: LabelRun[] = [];
  const push = (text: string, shift: LabelRun["shift"]) => {
    if (!text) return;
    // a script's minus is a true minus sign, as in TeX: x^{-1}
    if (shift) text = text.replace(/-/g, "\u2212");
    const last = runs[runs.length - 1];
    if (last && last.shift === shift) last.text += text;
    else runs.push({ text, shift });
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      push(source[index + 1], 0);
      index += 2;
      continue;
    }
    if ((char === "^" || char === "_") && index + 1 < source.length) {
      const shift = char === "^" ? 1 : -1;
      if (source[index + 1] === "{") {
        const close = source.indexOf("}", index + 2);
        if (close !== -1) {
          push(source.slice(index + 2, close), shift);
          index = close + 1;
          continue;
        }
      } else {
        // one code point, so λ or an emoji isn't split in half
        const next = String.fromCodePoint(source.codePointAt(index + 1)!);
        push(next, shift);
        index += 1 + next.length;
        continue;
      }
    }
    push(char, 0);
    index += 1;
  }
  return runs;
}

/** The label as plain text: what Chart.js lays out, before the markup is drawn. */
export function plainLabel(source: string): string {
  return parseLabelMarkup(source)
    .map((run) => run.text)
    .join("");
}

/** Draw runs centred on (0, 0), on a middle baseline, in the current transform. */
function drawRuns(
  ctx: CanvasRenderingContext2D,
  runs: LabelRun[],
  family: string,
  size: number,
  color: string,
) {
  const fontFor = (run: LabelRun) =>
    `${run.shift ? size * SCRIPT_SCALE : size}px ${family}`;
  const widths = runs.map((run) => {
    ctx.font = fontFor(run);
    return ctx.measureText(run.text).width;
  });
  let x = -widths.reduce((sum, width) => sum + width, 0) / 2;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  runs.forEach((run, index) => {
    ctx.font = fontFor(run);
    const y = run.shift === 1 ? -0.38 * size : run.shift === -1 ? 0.26 * size : 0;
    ctx.fillText(run.text, x, y);
    x += widths[index];
  });
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

/**
 * Minor ticks between the majors, like matplotlib's AutoMinorLocator: five
 * divisions when the major step's mantissa is 1 or 5, four otherwise (2,
 * 2.5), carried on past the first and last major to the ends of the axis.
 */
export function minorTickValues(majors: number[], min: number, max: number): number[] {
  if (majors.length < 2) return [];
  const step = majors[1] - majors[0];
  if (!(step > 0)) return [];
  const mantissa = step / 10 ** Math.floor(Math.log10(step));
  const divisions = Math.abs(mantissa - 1) < 1e-6 || Math.abs(mantissa - 5) < 1e-6 ? 5 : 4;
  const minor = step / divisions;
  const values: number[] = [];
  const first = Math.ceil((min - majors[0]) / minor - 1e-9);
  const last = Math.floor((max - majors[0]) / minor + 1e-9);
  for (let k = first; k <= last; k += 1) {
    if (((k % divisions) + divisions) % divisions === 0) continue;
    values.push(majors[0] + k * minor);
  }
  return values;
}

/** Inward major and minor ticks on both spines of one axis; `factor` scales them for an export. */
function drawAxisTicks(
  ctx: CanvasRenderingContext2D,
  scale: Scale,
  area: { left: number; right: number; top: number; bottom: number },
  factor: number,
) {
  const majors = scale.ticks.map((tick) => tick.value);
  const minors = minorTickValues(majors, scale.min, scale.max);
  const horizontal = scale.isHorizontal();
  const stroke = (values: number[], length: number, width: number) => {
    ctx.lineWidth = width * factor;
    ctx.beginPath();
    for (const value of values) {
      const pixel = scale.getPixelForValue(value);
      if (horizontal) {
        if (pixel < area.left - 0.5 || pixel > area.right + 0.5) continue;
        ctx.moveTo(pixel, area.bottom);
        ctx.lineTo(pixel, area.bottom - length * factor);
        ctx.moveTo(pixel, area.top);
        ctx.lineTo(pixel, area.top + length * factor);
      } else {
        if (pixel < area.top - 0.5 || pixel > area.bottom + 0.5) continue;
        ctx.moveTo(area.left, pixel);
        ctx.lineTo(area.left + length * factor, pixel);
        ctx.moveTo(area.right, pixel);
        ctx.lineTo(area.right - length * factor, pixel);
      }
    }
    ctx.stroke();
  };
  stroke(majors, MAJOR_TICK_PX, MAJOR_TICK_WIDTH_PX);
  stroke(minors, MINOR_TICK_PX, MINOR_TICK_WIDTH_PX);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export type MatplotlibFrameOptions = {
  colors: SkinColors;
  /** raw axis labels, markup and all; Chart.js lays out their plain text */
  labels: { x?: string; y?: string };
  /** scales every pixel measure, for a high-resolution export */
  scale?: number;
};

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    matplotlibFrame?: MatplotlibFrameOptions;
  }
}

/**
 * Draws on top of the datasets: the four spines, inward major and minor
 * ticks on every side, and the axis labels with their markup. Chart.js still
 * lays the labels out (their titles are drawn transparent), so the space
 * they take is right; this only paints them.
 */
export const matplotlibFrame: Plugin<"scatter", MatplotlibFrameOptions> = {
  id: "matplotlibFrame",
  afterDraw(chart: Chart, _args, options) {
    const { ctx, chartArea: area } = chart;
    if (!area || !options.colors) return;
    const factor = options.scale ?? 1;
    ctx.save();
    ctx.strokeStyle = options.colors.frame;
    ctx.lineCap = "butt";
    for (const id of ["x", "y"]) {
      const scale = chart.scales[id];
      if (scale) drawAxisTicks(ctx, scale, area, factor);
    }
    ctx.lineWidth = SPINE_WIDTH_PX * factor;
    ctx.strokeRect(area.left, area.top, area.right - area.left, area.bottom - area.top);

    for (const id of ["x", "y"] as const) {
      const scale = chart.scales[id];
      const label = options.labels?.[id];
      if (!scale || !label) continue;
      const title = (scale.options as CartesianScaleOptions).title;
      if (!title?.display) continue;
      // where Chart.js puts the title (Scale.drawTitle: bottom and left edges)
      // resolved options: no longer scriptable by the time a plugin reads them
      const font = toFont(title.font as Partial<FontSpec>);
      const padding = toPadding(title.padding as number | TRBL);
      const offset = font.lineHeight / 2 + (id === "x" ? padding.bottom : padding.top);
      ctx.save();
      if (id === "x") {
        ctx.translate((scale.left + scale.right) / 2, scale.bottom - offset);
      } else {
        ctx.translate(scale.left + offset, (scale.top + scale.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
      }
      drawRuns(ctx, parseLabelMarkup(label), font.family, font.size, options.colors.text);
      ctx.restore();
    }
    ctx.restore();
  },
};
