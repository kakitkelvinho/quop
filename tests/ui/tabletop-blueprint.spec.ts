import { readFileSync } from "node:fs";
import { expect, test } from "./checks";

const themeMenu = (page: import("@playwright/test").Page) => page.getByRole("menu", { name: "Theme" });

async function chooseTheme(page: import("@playwright/test").Page, name: "Blueprint" | "Station") {
  await page.getByRole("toolbar", { name: "Tabletop status" }).getByRole("button", { name: /^Theme:/ }).click();
  await themeMenu(page).getByRole("menuitemradio", { name }).click();
}

test("Blueprint draws the example in day and night", async ({ page }, testInfo) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("region", { name: "Light follows the table" }).getByRole("button", { name: "Got it" }).click();
  await chooseTheme(page, "Blueprint");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
  await expect(page.locator(".builderWorkspace canvas")).toBeVisible();
  await expect(page.locator(".builderWorkspace")).toHaveScreenshot(`blueprint-example-${testInfo.project.name}.png`, {
    maxDiffPixelRatio: 0.01,
  });
});

test("Blueprint persists, exports the drawing, and restores the lit scene", async ({ page }, testInfo) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("region", { name: "Light follows the table" }).getByRole("button", { name: "Got it" }).click();
  await chooseTheme(page, "Blueprint");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blueprint");
  await expect(page.getByRole("toolbar", { name: "Tabletop status" }).getByRole("button", { name: /^Theme:/ })).toContainText("Blueprint");

  await page.getByRole("button", { name: "QUOP" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /^\.png/ }).click();
  const download = await downloadPromise;
  const png = readFileSync(await download.path());
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const corner = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, png.toString("base64"));
  expect(corner.slice(0, 3)).toEqual(testInfo.project.name === "dark" ? [10, 31, 61] : [255, 255, 255]);

  await chooseTheme(page, "Station");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "station");
  await expect(page.locator(".builderWorkspace")).toHaveScreenshot(`station-after-blueprint-${testInfo.project.name}.png`, {
    maxDiffPixelRatio: 0.01,
  });
});
