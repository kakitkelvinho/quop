# Note chart: can `InteractiveScatterChart` be a note figure that animates?

Throwaway branch for the wayfinder ticket "Can the scatter chart sit in a note and animate from changing data?" (kakitkelvinho/quop#300, map #298). Never merged.

## Recommendation

**Notes need a lighter chart.** Don't put `InteractiveScatterChart` in a note as it stands. Chart.js 4 and react-chartjs-2 do tween smoothly between data arrays, and at note size (3 × 300 points) an update is cheap. Two things in the wrapper block it:

1. **It remounts on almost every data change.** The default export keys the inner component on `buildDataSignature(data)` (point count, padded bounds, and the first and last point of each series). Change any of those and React destroys the chart and builds a new one. The points then grow out of the y = 0 line instead of moving from where they were, and zoom and customise state is reset.
2. **It is a tool, not a figure, and nothing can be turned off.** It always renders a 10-button toolbar, a help popover, customise and save menus, and drag-to-zoom and axis-pan gestures. It also overrides each series' colour, point radius and `showLine`. Its props are only `data`, `options`, `sourceLabel` and `formatXTick`.

A note figure should be a small component, `<Scatter>` from react-chartjs-2 plus the existing `matplotlibFrame` plugin and `CHART_STYLE_PALETTES`, with fixed axes and memoised options. The harness's "bare" chart is exactly that, and it tweens correctly. Before building it, move `axisStyle` and `scaleLayoutPadding` (private in `interactive-scatter-chart.tsx:317-357`) into `chart-style.ts` / `matplotlib-skin.ts`, so that the plotter and the note figure share one skin. An "open in plotter" link from a figure to the full tool is a separate option, if wanted.

Labels: **[V]** verified in the harness below; **[R]** read in source or docs (path given).

## What `InteractiveScatterChart` renders besides the plot

- **[R]** Footer toolbar (`interactive-scatter-chart.tsx:1820-1975`): reset zoom, zoom in, zoom out, scroll-zoom toggle (off by default), join-points toggle, customise menu (point size, font, title, axis labels, legend, ticks), chart-style toggle (global: it switches every chart on the page and persists in `localStorage`, see `chart-style.ts`), a per-chart dark mode toggle, save (PNG / SVG / PDF) and `ChartInfo` help. **[V]** All ten buttons are in the prerendered HTML and on screen in the harness screenshot.
- **[R]** Gestures on the stage (`:1136-1360`): drag in the plot zooms the x range, shift-drag zooms the y range, drag on an axis pans, and the wheel zooms only once scroll zoom is on. `pointerdown` calls `preventDefault` and captures the pointer. The stage has no `touch-action` rule, so on a phone a swipe that starts on the plot may begin a selection (not tested on touch).
- **[R]** It overrides the series' look (`:1633-1651`). Colours come from the style palette by index. `pointRadius` comes from its own state, seeded from dataset 0. `showLine` is one flag for all series, seeded from "any dataset has `showLine`". **[V]** In the harness, a `showLine: false` helper series was drawn joined.
- **[R]** No prop hides any of this. The stage also has `min-height: 22rem` (`globals.css:928`).

## How it re-renders when `data` changes

- **[R]** The wrapper (`:2322-2331`) uses `key={buildDataSignature(props.data)}`, and the signature (`:449-482`) covers point count, padded min/max on both axes, and each series' label, length, and first and last point. Any change to these remounts `InteractiveScatterChartInner`. That means a new `<Scatter>` and a new `Chart` (react-chartjs-2 `renderChart` runs in its mount effect), and every `useState` is reset, including the viewport, picked fonts and open menus.
- **[R]** The viewport, which becomes the scales' `min`/`max`, is `useState(baseBounds)` (`:1076-1077`). Without the remount, the axes would stay at the first data's bounds. The remount exists to make new data refit the axes.
- **[V]** Moving data (amplitude grows, so the bounds change): the Chart.js instance id goes from 0 to 3, which means a new chart. The tracked point does not travel from 189 px to 268 px. The new chart's first frame is ~218 px, rising from the zero line by the appear animation.
- **[V]** "Stable signature" data (standing waves with exact zeros at the ends, plus a fixed two-point `box` series that pins the bounds): no remount (same id), and the point tweens 75.9 → 102.2 px over ~1 s (default `easeOutQuart`, 1000 ms). The tween machinery does work inside the component. The signature is what defeats it. Even `sin(nπ) ≈ 1e-16` at an endpoint was enough to change the signature (it happened in the first harness run).

## Does Chart.js tween between arrays? (react-chartjs-2 5.3.1, Chart.js 4.5.1)

- **[R]** react-chartjs-2 (`node_modules/react-chartjs-2/dist/index.js`): with `redraw={false}` (the default), a change to `data.datasets` runs `setDatasets`, which matches each new dataset to the old one **by `label`** (`datasetIdKey`) and `Object.assign`s into the old object. A change to `options` runs `Object.assign(chart.options, options)`. Then one `chart.update(updateMode)`. `redraw={true}` destroys the chart and recreates it on every change, so no tween.
- **[R]** Chart.js: `getDatasetMeta` finds a dataset's elements by object identity (`chart.js:6160`), so a kept dataset object keeps its point elements. `_dataCheck` (`:658`) sees the new `data` array and re-parses it. `_resyncElements` (`:1056`) reuses elements **by index**, inserts extras (they start from the reset position) and drops surplus ones. The element animations then run `x`, `y`, `borderWidth`, `radius` and `tension` (`helpers.dataset.js:768`) from the current value to the new one: 1000 ms, `easeOutQuart` by default. The line is drawn through the animated points, so it moves with them.
- **[R]** A new update during a running animation retargets from the current interpolated value (`Animation.update`, `chart.js:190-211`), so fast stepping (scroll) stays continuous instead of jumping.
- **[R]** Scales are not animated. Ticks and the axis range jump to the new layout, and points tween to their new pixel positions. Fixed `min`/`max` across all steps is what makes a step look like motion.
- **[V]** Bare chart (fixed axes, `animation: { duration: 600, easing: "easeInOutCubic" }`): same instance, point tweens 176.0 → 206.4 px over 36 distinct frames (~600 ms).
- **[V]** **Unlabelled datasets break it.** With no `label`, all three new datasets match the first old one. Dataset 0 kept its meta, and datasets 1 and 2 got new metas (`sameMetaPerDataset: [true, false, false]`), so they regrow from the reset position instead of tweening. Every series needs a unique, stable `label`, or a `datasetIdKey`.
- **[R]** Chart.js has no `prefers-reduced-motion` handling (no match in `dist/chart.js`). A note has to set `animation: false` itself.

## Cost at note size (3 series × 300 points, lines, no point markers)

Headless Chromium 153, 4-core Xeon 2.8 GHz sandbox (canvas probably software-rasterised), static build. Each chart was on its own page (`?only=`). `step→frame` is the time from `setState` to two `requestAnimationFrame`s later, so it includes up to ~1 frame of waiting. `update('none')` and `draw()` are raw Chart.js times on the mounted chart. **[V]** for all rows:

| | step→frame p50 / max | frame interval during tween p50 / p95 / max | `update('none')` | `draw()` |
|---|---|---|---|---|
| ISC, bounds change (remount) | 44 / 71 ms | 16.7 / 17.5 / 56 ms | 3.0 ms | 0.19 ms |
| ISC, stable signature | 31 / 42 ms | 16.7 / 20.6 / 25 ms | 3.1 ms | 0.16 ms |
| bare `<Scatter>` | 33 / 68 ms | 16.7 / 20.0 / 31 ms | 2.1 ms | 0.37 ms |
| *CPU ×4 throttle:* ISC remount | 167 / 225 ms | 16.5 / 34 / 161 ms | 23 ms | 1.4 ms |
| *CPU ×4:* ISC stable | 107 / 151 ms | 16.5 / 23 / 130 ms | 14 ms | 1.0 ms |
| *CPU ×4:* bare | 122 / 136 ms | 16.5 / 18.6 / 115 ms | 11 ms | 1.3 ms |

Reading: tweens run at 60 fps once started. Each step costs one long first frame (the update: parse, layout, React commit), and the frames after it are cheap (draws under 1.5 ms even at ×4). That is fine for slide-stepped or scroll-stepped animation. Scrubbing by calling `update('none')` on every scroll frame costs 2–3 ms (×1) and 11–23 ms (×4) at 900 points, which is fine on a laptop and tight on a slow phone. The remounting ISC costs ~1.4× the bare chart per step at ×1, and its animation is the wrong one anyway.

The ×4 run of the "all three charts on one page" tween trace did not record usable traces (rAF barely fired while three charts animated together). Remount and tween behaviour is therefore taken from the ×1 run.

## Static export (`output: "export"`)

- **[V]** `next build` with the harness page succeeds and prerenders it as static (`○`), with type-checking. The HTML holds `<canvas role="img" width="300" height="150">` placeholders and the ISC toolbars. Charts draw after hydration. No console errors, warnings or page errors during load, stepping or re-mounting. The screenshot shows all three charts drawn correctly (`matplotlibFrame` ticks and spines on the bare chart).
- **[R]** `useChartStyle` uses `useSyncExternalStore` with a server snapshot of `"chartjs"`, so a reader who picked matplotlib gets one re-render after hydration and no mismatch. ISC's colour mode starts as `"light"` and syncs in an effect, so a dark-theme reader may briefly see a light first draw (not tested).
- **[R]** `matplotlib-skin.ts` loads CMU Serif through `next/font/local`, which works in the export. The bare chart in the harness did not set `font.family`, so its ticks are in Chart.js's default font. A note figure must pass `MATPLOTLIB_FONT_FAMILY` (or `CHART_STYLE_FONTS[style]`) and redraw after `document.fonts.load`, as ISC does (`:973-984`).

## For later tickets

- **#304 (animation model):** "animate = new data array per step" works if each step keeps (a) the same unique `label` per series, (b) the same point count per series (points are matched by index, so extras regrow from zero and missing ones vanish), and (c) fixed axis `min`/`max`, best taken from the union over all steps, because scales jump. Memoise `options`: react-chartjs-2 calls `update()` whenever the `options` identity changes. Retargeting mid-tween is built in. Duration and easing are per chart (`animation`). Reduced motion has to be handled by us.
- **#301 (layout prototype):** budget a fixed-height box per figure. A responsive Chart.js chart needs a sized, `position: relative` parent (the harness used 22rem). The figure should not carry ISC's toolbar. Decide whether note figures follow the global chart-style toggle or pin the matplotlib look.

## Run

```sh
mkdir -p src/app/research-note-chart && cp research/note-chart/page.tsx src/app/research-note-chart/page.tsx
npx next build                          # static export into out/
node research/note-chart/run.mjs out 1  # serves out/ on :4318, drives Chromium; 2nd arg = CPU throttle
node research/note-chart/run.mjs out 4
rm -rf src/app/research-note-chart
```

Needs `playwright` resolvable from the checkout (it is global in the agent sandbox). Results above are from 2026-10-24 at d9d3477: Node 22, Next 16.4.2, React 19.2.3.
