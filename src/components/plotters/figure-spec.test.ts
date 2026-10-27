import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CHART_STYLE_PALETTES, CLASSIC_DARK, CLASSIC_EXPORT, CLASSIC_LIGHT } from "./chart-style.ts";
import {
  figureData,
  figureOptions,
  formatClockTick,
  formatTickValue,
  titleFromFileName,
  type FigureState,
} from "./figure-spec.ts";
import { DARK_SKIN, LIGHT_SKIN } from "./matplotlib-skin.ts";

const state: FigureState = {
  style: "matplotlib",
  fontFamily: "serif",
  pointSize: 2,
  joinedPoints: true,
  title: "power",
  titleFontSize: 18,
  xLabel: "λ_0 (nm)",
  yLabel: "|E|^2",
  axisLabelFontSize: 14,
  legend: "points",
  legendFontSize: 12,
  xTicks: { multiplier: 1, decimalPlaces: null, fontSize: 12 },
  yTicks: { multiplier: 1, decimalPlaces: null, fontSize: 12 },
  viewport: { xMin: 0, xMax: 10, yMin: -1, yMax: 1 },
  animate: true,
};

const series = [
  { label: "a", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
  { label: "b", points: [{ x: 0, y: 3 }] },
];

// the scales as plain objects: Chart.js's types make every key optional
function axis(options: ReturnType<typeof figureOptions>, id: "x" | "y") {
  return options.scales?.[id] as Record<string, unknown> & {
    grid: Record<string, unknown>;
    border: Record<string, unknown>;
    ticks: Record<string, unknown> & {
      callback: (value: number, index: number, ticks: { value: number }[]) => string;
      font: { size: number };
    };
    title: Record<string, unknown>;
    afterBuildTicks?: (axis: { min: number; max: number; ticks: { value: number }[] }) => void;
  };
}

describe("figureOptions in the matplotlib style", () => {
  it("draws the frame and no grid, in black on a light page", () => {
    const options = figureOptions(state, { kind: "screen", theme: "light" });
    const x = axis(options, "x");

    assert.equal(options.color, LIGHT_SKIN.text);
    assert.deepEqual(options.plugins?.matplotlibFrame, {
      colors: LIGHT_SKIN,
      labels: { x: "λ_0 (nm)", y: "|E|^2" },
      frame: true,
    });
    assert.deepEqual(x.grid, { display: false });
    assert.deepEqual(x.border, { display: false });
    assert.equal(x.ticks.padding, 6);
    assert.equal(x.ticks.color, LIGHT_SKIN.text);
    // laid out as plain text, painted by the frame plugin
    assert.deepEqual(x.title, {
      display: true,
      color: "transparent",
      text: "λ0 (nm)",
      padding: { top: 4, bottom: 4 },
      font: { family: "serif", size: 14 },
    });
    assert.deepEqual(options.layout, { padding: { top: 6, right: 14, bottom: 4, left: 4 } });
    assert.equal(options.plugins?.title?.font && "weight" in options.plugins.title.font ? options.plugins.title.font.weight : null, "normal");
  });

  it("draws in the dark skin on a dark page", () => {
    const options = figureOptions(state, { kind: "screen", theme: "dark" });

    assert.equal(options.color, DARK_SKIN.text);
    assert.deepEqual(options.plugins?.matplotlibFrame?.colors, DARK_SKIN);
    assert.equal(axis(options, "y").ticks.color, DARK_SKIN.text);
    assert.equal(options.plugins?.tooltip?.backgroundColor, "rgba(15, 19, 28, 0.96)");
  });

  it("colours the series by tab10, with matplotlib's line width", () => {
    const data = figureData(series, state, { kind: "screen" });

    assert.deepEqual(
      data.datasets.map((dataset) => dataset.borderColor),
      CHART_STYLE_PALETTES.matplotlib.slice(0, 2),
    );
    assert.equal(data.datasets[0].borderWidth, 1.5);
    assert.equal(data.datasets[0].pointRadius, 2);
    assert.equal(data.datasets[0].pointHoverRadius, 3.5);
    assert.equal(data.datasets[0].showLine, true);
    // the screen draws the caller's own points
    assert.equal(data.datasets[0].data, series[0].points);
  });
});

describe("figureOptions in the Chart.js style", () => {
  const classic = { ...state, style: "chartjs" as const };

  it("draws Chart.js's own grid and border on a light page", () => {
    const options = figureOptions(classic, { kind: "screen", theme: "light" });
    const x = axis(options, "x");

    assert.equal(options.color, CLASSIC_LIGHT.text);
    assert.deepEqual(x.grid, { color: CLASSIC_LIGHT.grid });
    assert.deepEqual(x.border, {});
    assert.equal(x.ticks.padding, undefined);
    assert.equal(x.title.padding, undefined);
    assert.equal(options.layout, undefined);
    assert.deepEqual(options.plugins?.matplotlibFrame, {
      colors: { text: CLASSIC_LIGHT.text, frame: CLASSIC_LIGHT.grid },
      labels: { x: "λ_0 (nm)", y: "|E|^2" },
      frame: false,
    });
    assert.equal(options.plugins?.title?.font && "weight" in options.plugins.title.font ? options.plugins.title.font.weight : null, "bold");
  });

  it("draws in the dark set on a dark page", () => {
    const options = figureOptions(classic, { kind: "screen", theme: "dark" });

    assert.equal(options.color, CLASSIC_DARK.text);
    assert.deepEqual(axis(options, "y").grid, { color: CLASSIC_DARK.grid });
  });

  it("colours the series by the classic palette, two pixels wide", () => {
    const data = figureData(series, classic, { kind: "screen" });

    assert.deepEqual(
      data.datasets.map((dataset) => dataset.borderColor),
      CHART_STYLE_PALETTES.chartjs.slice(0, 2),
    );
    assert.equal(data.datasets[0].borderWidth, 2);
  });
});

describe("an export", () => {
  it("is the light figure, whatever the page shows, scaled throughout", () => {
    const options = figureOptions({ ...state, style: "chartjs" }, { kind: "export", scale: 3 });
    const x = axis(options, "x");

    assert.equal(options.responsive, false);
    assert.equal(options.animation, false);
    assert.equal(options.color, CLASSIC_EXPORT.text);
    assert.deepEqual(x.grid, { color: CLASSIC_EXPORT.grid });
    assert.equal(x.ticks.font.size, 36);
    assert.equal(options.plugins?.matplotlibFrame?.scale, 3);
    assert.equal(options.elements?.point?.radius, 6);
  });

  it("scales matplotlib's paddings and swatches", () => {
    const options = figureOptions(state, { kind: "export", scale: 3 });

    assert.equal(options.color, LIGHT_SKIN.text);
    assert.equal(axis(options, "x").ticks.padding, 18);
    assert.deepEqual(options.layout, { padding: { top: 18, right: 42, bottom: 12, left: 12 } });
    assert.equal(options.plugins?.legend?.labels?.boxWidth, 30);
    assert.equal(options.plugins?.legend?.labels?.boxHeight, 15);
  });

  it("copies the points, so the export chart shares nothing with the screen's", () => {
    const data = figureData(series, state, { kind: "export", scale: 3 });

    assert.notEqual(data.datasets[0].data, series[0].points);
    assert.deepEqual(data.datasets[0].data, series[0].points);
    assert.equal(data.datasets[0].pointRadius, 6);
    assert.equal(data.datasets[0].borderWidth, 4.5);
  });
});

describe("the legend", () => {
  it("is hidden when off", () => {
    const options = figureOptions({ ...state, legend: null }, { kind: "screen", theme: "light" });

    assert.deepEqual(options.plugins?.legend, { display: false });
  });

  it("marks series with dots, on top", () => {
    const options = figureOptions({ ...state, style: "chartjs" }, { kind: "screen", theme: "light" });

    assert.equal(options.plugins?.legend?.display, true);
    assert.equal(options.plugins?.legend?.position, "top");
    assert.deepEqual(options.plugins?.legend?.labels, {
      usePointStyle: true,
      boxWidth: 10,
      color: CLASSIC_LIGHT.text,
      font: { family: "serif", size: 12 },
    });
  });

  it("keeps Chart.js's boxes when asked, except in the matplotlib style", () => {
    const boxes = { ...state, legend: "boxes" as const };

    assert.deepEqual(
      figureOptions({ ...boxes, style: "chartjs" }, { kind: "screen", theme: "light" }).plugins?.legend?.labels,
      { color: CLASSIC_LIGHT.text, font: { family: "serif", size: 12 } },
    );
    assert.deepEqual(figureOptions(boxes, { kind: "screen", theme: "light" }).plugins?.legend?.labels, {
      usePointStyle: true,
      boxHeight: 5,
      color: LIGHT_SKIN.text,
      font: { family: "serif", size: 12 },
    });
  });
});

describe("the x ticks", () => {
  it("write plain numbers by default, with the user's power of ten", () => {
    const x = axis(figureOptions({ ...state, xTicks: { multiplier: 1000, decimalPlaces: null, fontSize: 12 } }, { kind: "screen", theme: "light" }), "x");
    const ticks = [{ value: 0.001 }, { value: 0.002 }];

    assert.equal(x.ticks.callback(0.002, 1, ticks), "2");
    assert.equal(x.afterBuildTicks, undefined);
    assert.equal(figureOptions(state, { kind: "screen", theme: "light" }).plugins?.tooltip?.callbacks, undefined);
  });

  it("write a Clock column as times of day, on whole steps of the clock", () => {
    const clock = { ...state, xFormat: { kind: "clock" as const, seconds: true } };
    const options = figureOptions(clock, { kind: "screen", theme: "light" });
    const x = axis(options, "x");
    const scale = { min: 11 * 3600 + 100, max: 13 * 3600, ticks: [] as { value: number }[] };

    x.afterBuildTicks?.(scale);
    assert.deepEqual(
      scale.ticks.map((tick) => tick.value),
      [11 * 3600 + 900, 11 * 3600 + 1800, 11 * 3600 + 2700, 12 * 3600, 12 * 3600 + 900, 12 * 3600 + 1800, 12 * 3600 + 2700, 13 * 3600],
    );
    assert.equal(x.ticks.callback(12 * 3600, 3, scale.ticks), "12:00");
    // the y axis stays numeric
    assert.equal(axis(options, "y").afterBuildTicks, undefined);
  });

  it("show the readings' seconds in the tooltip of a Clock column", () => {
    const options = figureOptions(
      { ...state, xFormat: { kind: "clock", seconds: true } },
      { kind: "screen", theme: "light" },
    );
    const label = options.plugins?.tooltip?.callbacks?.label as unknown as (context: unknown) => string;

    assert.equal(label({ dataset: { label: "a" }, parsed: { x: 11 * 3600 + 5, y: 2 } }), "a: (11:00:05, 2)");
  });
});

describe("formatClockTick", () => {
  it("adds seconds when the ticks are less than a minute apart", () => {
    assert.equal(formatClockTick(3600 + 30, [{ value: 3600 }, { value: 3630 }]), "01:00:30");
    assert.equal(formatClockTick(3600, [{ value: 3600 }, { value: 3660 }]), "01:00");
  });
});

describe("formatTickValue", () => {
  it("uses the fewest decimals that show every tick", () => {
    const ticks = [{ value: 0 }, { value: 2.5 }, { value: 5 }];
    assert.equal(formatTickValue(5, 1, null, ticks), "5.0");
    assert.equal(formatTickValue(0, 1, null, ticks), "0.0");
  });

  it("writes very large or small values with a true minus sign", () => {
    assert.equal(formatTickValue(-2e-5, 1, null, []), "\u22122e\u22125");
    assert.equal(formatTickValue(1.5, 1, 2), "1.50");
  });
});

describe("titleFromFileName", () => {
  it("drops the folders and the extension", () => {
    assert.equal(titleFromFileName("C:\\data\\power15.csv"), "power15");
    assert.equal(titleFromFileName("bec15.fits"), "bec15");
    assert.equal(titleFromFileName(undefined), "");
    assert.equal(titleFromFileName(" / "), "");
  });
});
