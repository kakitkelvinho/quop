import { expect, test } from "./checks";

test("2001 sets labels in Gillius and keeps the Light panel's buttons on the screen", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.evaluate(() => localStorage.setItem("site-theme", "2001"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "2001");

  const title = page.locator(".builderLightList__panel .builderPanelBar__title");
  await expect(title).toHaveCSS("font-family", /gillius/i);
  await expect(page.locator(".builderLightList__readouts").first()).toHaveCSS("font-family", /archivo/i);

  // by day the page surface is white, and a button that read it showed blank
  const readout = page.locator(".builderLightList__readout").first();
  await expect(readout).toHaveCSS("background-color", "rgb(5, 8, 11)");
});
