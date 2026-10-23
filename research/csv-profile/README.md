# CSV plotter profile: revolution_humidity.csv

Throwaway branch for the wayfinder ticket "Profile the CSV plotter on revolution_humidity.csv" (kakitkelvinho/quop#281). Never merged.

The file (17 088 rows × 9 logical columns, 851 KB) is the user's lab data and is **not** in this branch.

## Run

From a quop checkout with `node_modules` installed (Node ≥ 23, for `.ts` imports):

```sh
node --no-warnings research/csv-profile/pipeline.mjs <file.csv>   # parse → chartData → wrapper scans → Chart.js (no-op canvas) → React picker
node --no-warnings research/csv-profile/scaling.mjs               # Chart.js update time vs series count
# real browser (needs a static build served on :4317, playwright-core in $PW_DIR, a Chromium in $CHROME):
node research/csv-profile/browser.mjs <file.csv> [baseUrl]
```

`browser.mjs` could not run in the agent's sandbox (Chromium's Mach-port check-in is denied), so its numbers are not in the results below.

## Results (2026-10-23, Apple Silicon, Node 24, Chart.js 4.5.1, React 19.2, at bf5d037)

| step | auto layout (today) | columns layout |
|---|---|---|
| layout the parser picks | **rows**: 17 088 series × 4 points | 6 series × 17 089 points |
| `parseGenericCsv` | 34 ms | 29 ms |
| plotter `chartData` (rebuilt every render) | 2 ms | 2 ms |
| wrapper `buildDataSignature` (every render) | 6 ms | 6 ms |
| React picker rows (renderToString) | 217 ms (17 088 rows) | 0.4 ms |
| Chart.js `new Chart` (no-op canvas) | 4 105 ms | 51 ms |
| Chart.js `update()` with fresh datasets | 11 734 ms | 56 ms |
| same, legend hidden | 12 139 ms | 53 ms |
| Metadata textarea | 1.97 MB of `row N · …` lines | 52 chars |

Chart.js update vs series count (4 points each): 500 → 42 ms, 1 000 → 90 ms, 2 000 → 246 ms, 4 000 → 716 ms, 8 000 → 2 782 ms (roughly quadratic).
