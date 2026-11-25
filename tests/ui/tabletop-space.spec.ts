import { expect, test } from "./checks";

test("Space sets labels in Gillius and keeps the Light panel's buttons on the screen", async ({ page }, testInfo) => {
  await page.goto("builder/tabletop/");
  await page.evaluate(() => localStorage.setItem("site-theme", "space"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "space");

  const title = page.locator(".builderLightList__panel .builderPanelBar__title");
  await expect(title).toHaveCSS("font-family", /gillius/i);
  await expect(page.locator(".builderLightList__readouts").first()).toHaveCSS("font-family", /archivo/i);

  // the buttons take the screen's colour, white by day and black by night,
  // with the phosphor ink on it, rather than the page surface
  const readout = page.locator(".builderLightList__readout").first();
  const night = testInfo.project.name === "dark";
  await expect(readout).toHaveCSS("background-color", night ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
  await expect(readout).toHaveCSS("color", night ? "rgb(232, 241, 245)" : "rgb(13, 19, 23)");
});

test("Space draws part labels as acrylic slides in Gillius", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.evaluate(() => localStorage.setItem("site-theme", "space"));
  await page.reload();
  const label = page.locator(".builderLabel").first();
  await expect(label).toHaveCSS("font-family", /gillius/i);
  await expect(label).toHaveCSS("backdrop-filter", "blur(1.5px)");
});
