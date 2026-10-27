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

// When the bundled sample can't be fetched, a FITS plotter says so, rather
// than "No file." as though nothing had been asked for.
for (const plotterPath of ["plotters/fits-plotter/", "plotters/csv-fits-viewer/"]) {
  test(`${plotterPath} says when its sample FITS file can't be loaded`, async ({ page }) => {
    await page.route("**/data/bec15.fits", (route) => route.abort());
    await page.goto(plotterPath);

    await expect(
      page.locator(".resultCard", { hasText: "Couldn't load the sample file bec15.fits" }),
    ).toBeVisible();
  });
}

test("typing in the CSV Plotter's contents keeps the column filter", async ({ page }) => {
  await page.goto("plotters/generic-csv-plotter/");
  await page
    .getByLabel("Choose a CSV, TSV or TXT file")
    .setInputFiles(path.join(__dirname, "fixtures", "many-columns.csv"));
  await expect(page.locator(".resultCard")).toHaveText("5 rows.");

  const filter = page.getByLabel("Filter columns");
  await filter.fill("signal_1");

  // an edit to the table keeps the picker as it was
  const contents = page.getByLabel("CSV input");
  await contents.press("Control+End");
  await contents.pressSequentially("0");
  await expect(contents).toHaveValue(/\n0$/);
  await expect(filter).toHaveValue("signal_1");

  // a new file starts it over
  await page
    .getByLabel("Choose a CSV, TSV or TXT file")
    .setInputFiles(path.join(__dirname, "fixtures", "many-columns.csv"));
  await expect(page.getByLabel("Filter columns")).toHaveValue("");
});

test("a file held over a file picker keeps it outlined over the picker's own parts", async ({ page }) => {
  await page.goto("plotters/csv-plotter/");
  const drop = page.locator(".fileDrop").first();

  // the browser fires a leave on the row whenever the pointer moves onto
  // one of its children; only a leave to outside the row ends the outline
  const drag = (type: string, relatedTo: string | null) =>
    drop.evaluate(
      (element, { type, relatedTo }) => {
        const relatedTarget = relatedTo ? element.querySelector(relatedTo) ?? document.body : null;
        element.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, relatedTarget }),
        );
      },
      { type, relatedTo },
    );

  await drag("dragover", null);
  await expect(drop).toHaveClass(/is-over/);
  await drag("dragleave", ".fileDrop__button");
  await expect(drop).toHaveClass(/is-over/);
  await drag("dragleave", "body");
  await expect(drop).not.toHaveClass(/is-over/);
});
