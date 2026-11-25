import { expect, test } from "./checks";

test("Space sets labels in Gillius and keeps the Light panel's buttons on the screen", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.evaluate(() => localStorage.setItem("site-theme", "space"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "space");

  const title = page.locator(".builderLightList__panel .builderPanelBar__title");
  await expect(title).toHaveCSS("font-family", /gillius/i);
  await expect(page.locator(".builderLightList__readouts").first()).toHaveCSS("font-family", /archivo/i);

  // by day the page surface is white, and a button that read it showed blank
  const readout = page.locator(".builderLightList__readout").first();
  await expect(readout).toHaveCSS("background-color", "rgb(5, 8, 11)");
});

test("Space draws part labels as acrylic slides in Gillius", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.evaluate(() => localStorage.setItem("site-theme", "space"));
  await page.reload();
  const label = page.locator(".builderLabel").first();
  await expect(label).toHaveCSS("font-family", /gillius/i);
  await expect(label).toHaveCSS("backdrop-filter", "blur(1.5px)");
});
