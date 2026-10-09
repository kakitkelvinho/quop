import { BasicPlatform, Chart, type ChartConfiguration } from "chart.js";

import type { PlacedRun } from "./matplotlib-skin.ts";

// A chart as an SVG file: the same Chart.js config the PNG export draws,
// replayed once into a 2D context that records SVG elements (svgcanvas)
// instead of pixels. Text stays text, so labels can be edited in Inkscape or
// Illustrator.

const SVG_NS = "http://www.w3.org/2000/svg";
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);

/** Family names the page knows that a file can't: renamed, or dropped (`null`). */
export type FontAliases = Readonly<Record<string, string | null>>;

/** The names in a CSS font-family list, unquoted. */
export function fontFamilyNames(value: string): string[] {
  return value
    .split(",")
    .map((name) => name.trim().replace(/^(["'])(.*)\1$/, "$2"))
    .filter(Boolean);
}

/** A font-family list as a file off this page can resolve it. */
export function portableFontFamily(value: string, aliases: FontAliases): string {
  const names = fontFamilyNames(value).flatMap((name) => {
    const alias = Object.hasOwn(aliases, name) ? aliases[name] : name;
    return alias === null ? [] : [alias];
  });
  return [...new Set(names)]
    .map((name) => (GENERIC_FAMILIES.has(name) ? name : `'${name}'`))
    .join(", ");
}

function isTransparent(style: unknown): boolean {
  return (
    style === "transparent" ||
    (typeof style === "string" && /^rgba\([^)]*,\s*0(\.0*)?\s*\)$/.test(style.trim()))
  );
}

async function recordingContext(width: number, height: number) {
  const { Context } = await import("svgcanvas");

  return new (class extends Context {
    // Chart.js's BasicPlatform asks its "canvas" for a context; this is both
    getContext() {
      return this;
    }

    // Chart.js lays a title out by drawing it transparent; a file would keep it as a hidden duplicate
    fillText(text: string, x: number, y: number) {
      if (!isTransparent(this.fillStyle)) super.fillText(text, x, y);
    }

    /** One <text>, its runs as <tspan>s that flow, so a script stays beside its base in any font. */
    fillTextRuns(runs: PlacedRun[]) {
      if (isTransparent(this.fillStyle)) return;
      this.textAlign = "center";
      this.fillText(runs.map((run) => run.text).join(""), 0, 0);
      const texts = this.getSvg().getElementsByTagName("text");
      const text = texts[texts.length - 1];
      text.textContent = "";
      let y = 0;
      for (const run of runs) {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("font-size", `${run.size}px`);
        if (run.y !== y) tspan.setAttribute("dy", String(run.y - y));
        tspan.textContent = run.text;
        text.appendChild(tspan);
        y = run.y;
      }
    }
  })({ width, height });
}

/** Draw a chart config once, `width` × `height` CSS pixels, and return the SVG file's text. */
export async function renderChartSvg(
  config: ChartConfiguration<"scatter">,
  width: number,
  height: number,
  fontAliases: FontAliases,
): Promise<string> {
  const context = await recordingContext(width, height);
  const chart = new Chart(context as unknown as HTMLCanvasElement, {
    ...config,
    // a line goes through a cached Path2D, which a recording context can't read,
    // unless its dataset has segment options; then Chart.js strokes it directly
    data: { ...config.data, datasets: config.data.datasets.map((dataset) => ({ segment: {}, ...dataset })) },
    platform: BasicPlatform,
    options: { ...config.options, animation: false, devicePixelRatio: 1, responsive: false },
  });

  try {
    const svg = context.getSvg();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    for (const text of svg.querySelectorAll("text")) {
      text.setAttribute("font-family", portableFontFamily(text.getAttribute("font-family") ?? "", fontAliases));
      // svgcanvas writes the underline it never set as the word "undefined"
      text.removeAttribute("text-decoration");
    }
    return context.getSerializedSvg(true);
  } finally {
    chart.destroy();
  }
}
