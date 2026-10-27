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
    // A chart takes its size from the text around it as first drawn, so if a
    // web font arrives late the chart can end up a few pixels off. Opening
    // the page twice means the second visit has every font in the cache.
    await page.goto(plotter.path);
    await page.evaluate(() => document.fonts.ready);
    await page.reload();
    for (const text of plotter.status) {
      await expect(page.locator(".resultCard", { hasText: text })).toBeVisible();
    }
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page).toHaveScreenshot({ fullPage: true });
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
