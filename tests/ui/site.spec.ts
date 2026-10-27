import { expect, test } from "./checks";

// The pages around the plotters. Addresses have no leading slash so they
// stay under the base path.

test("homepage", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Quantum optics, in the browser.",
  );
  await expect(page.getByRole("navigation", { name: "Tools" }).getByRole("link")).toHaveCount(3);
  // The chalk equations behind the title land in random places, so they are
  // hidden for the screenshot.
  await page.addStyleTag({ content: ".chalkLayer, .chalkboard__ghosts { visibility: hidden; }" });
  await expect(page).toHaveScreenshot({ fullPage: true });
});

test("plotters index", async ({ page }) => {
  await page.goto("plotters/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plotters");
  await expect(page).toHaveScreenshot({ fullPage: true });
});

test("Builder opens with its table", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const table = page.locator("canvas");
  await expect(table).toBeVisible();
  // The 3D table is drawn with WebGL, which can differ by a few pixels from
  // run to run, so it is hidden and only the panels over it compared.
  await page.addStyleTag({ content: "canvas { visibility: hidden; }" });
  await expect(page).toHaveScreenshot();
});

test("an unknown address shows the 404 page", async ({ page }) => {
  const response = await page.goto("no-such-page/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No page at this address.");
  const address = page.locator(".notFound__address");
  await expect(address).toHaveText(/\/no-such-page\/$/);
  // the 404 page fetches the site's other pages ahead of a click; let that settle
  await page.waitForLoadState("networkidle");
  // On CI the address starts with the /quop base path, so the screenshot
  // shows it without, the same everywhere.
  await address.evaluate((element) => {
    element.textContent = "/no-such-page/";
  });
  await expect(page).toHaveScreenshot();
});
