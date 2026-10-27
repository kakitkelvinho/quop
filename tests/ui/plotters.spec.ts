import path from "node:path";

import { expect, test } from "./checks";

// Each plotter opens with a bundled sample already plotted. A test checks
// the chart is drawn, that the status line describes the sample, and that
// the whole page still looks like its saved screenshot.
// Addresses have no leading slash so they stay under the base path.

const plotters = [
  { path: "plotters/csv-plotter/", status: ["Plotting 1024 rows from power15.csv."] },
  { path: "plotters/generic-csv-plotter/", status: ["240 rows."] },
  { path: "plotters/array-plotter/", status: ["7 points."] },
  { path: "plotters/fits-plotter/", status: ["Range 3.270e+2 to 4.530e+2"] },
  { path: "plotters/csv-fits-viewer/", status: ["1024 rows.", "Range 3.270e+2 to 4.530e+2"] },
];

for (const plotter of plotters) {
  test(`${plotter.path} plots its sample`, async ({ page }) => {
    await page.goto(plotter.path);
    for (const text of plotter.status) {
      await expect(page.locator(".resultCard", { hasText: text })).toBeVisible();
    }
    await expect(page.locator("canvas").first()).toBeVisible();
    // A chart sizes itself to the space around it, and that space depends on
    // the chart, so it settles a pixel or two differently from run to run.
    // Giving each chart a fixed height for the screenshot keeps it the same.
    await page.addStyleTag({ content: ".interactiveChart__stage { height: 420px; }" });
    // A chart also measures its labels with whatever font is ready when it
    // first draws, which can move the plot area by a pixel or two. So a
    // plotter may differ in up to 1% of its pixels, not the usual 0.1%:
    // that jitter stays well under it, and a broken chart goes far over it.
    await expect(page).toHaveScreenshot({ fullPage: true, maxDiffPixelRatio: 0.01 });
  });
}

test("the Time CSV Plotter plots an uploaded file", async ({ page }) => {
  await page.goto("plotters/csv-plotter/");
  await expect(page.locator(".resultCard")).toContainText("power15.csv");

  await page
    .getByLabel("Choose a CSV, TSV or TXT file")
    .setInputFiles(path.join(__dirname, "fixtures", "five-rows.csv"));

  await expect(page.locator(".resultCard")).toHaveText(
    "Plotting 5 rows from five-rows.csv. X-axis: time. Channels: ch1, ch2.",
  );
  await expect(page.locator("canvas").first()).toBeVisible();
});
