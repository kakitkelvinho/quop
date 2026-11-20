import { expect, test } from "./checks";
import type { Page } from "@playwright/test";

/** Replace the table with the example, its lens raised out of the Beam: one check fails. */
async function raiseTheLens(page: Page) {
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const json = page.getByRole("textbox", { name: "The setup, as JSON" });
  const original = JSON.parse(await json.inputValue());
  const components = original.components.map((part: { type: string; position: number[] }) =>
    part.type === "lens" ? { ...part, position: [part.position[0], 200, part.position[2]] } : part,
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "raised-lens.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...original, components })),
  });
  await page.getByRole("button", { name: "Replace the table" }).click();
}

test("the status bar shows the mode while placing", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const bar = page.locator(".builderBar");
  await expect(bar).toContainText("Select");
  await expect(bar).toContainText("Light reaches every stop");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Part: Open the parts panel/ }).click();
  await page.getByRole("complementary", { name: "Parts" }).locator(".builderPart").first().click();
  await expect(bar.getByLabel("Mode")).toContainText("place");
  await expect(bar.getByLabel("Mode")).toContainText("cancel");
  await page.keyboard.press("Escape");
  await expect(bar.getByLabel("Mode")).toHaveText("Select");
});

test("the checks list opens, selects a check's Component, and Esc closes it", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await raiseTheLens(page);
  const toggle = page.locator(".builderBar").getByRole("button", { name: /1 check/ });
  await toggle.click();
  const list = page.getByRole("list", { name: "Traced light checks" });
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();

  await toggle.click();
  await list.getByRole("button").first().click();
  await expect(list).toBeHidden();
  await expect(page.locator(".builderHud__inspector")).toBeVisible();
});

test("Legacy view and back keep the page's settings, and the bar stays in the legacy view", async ({ page }) => {
  await page.goto("builder/tabletop/?graphics=light");
  await page.getByRole("link", { name: "Legacy view" }).click();
  await expect(page).toHaveURL(/\?graphics=light&traced=0$/);
  await expect(page.locator(".builderBar")).toContainText("Legacy view: drawn Beams, not traced");

  await page.getByRole("link", { name: "Switch to traced Beams" }).click();
  await expect(page).toHaveURL(/\?graphics=light$/);
  await expect(page.locator(".builderBar")).toContainText("Light reaches every stop");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("the bar shows no mode, and nothing wraps or runs off the edge", async ({ page }) => {
    await page.goto("builder/tabletop/");
    const bar = page.locator(".builderBar");
    await expect(bar).toBeVisible();
    await expect(bar.getByLabel("Mode")).toBeHidden();
    const { pageWidth, barWidth, barScroll, barHeight, cellsInside } = await bar.evaluate((element) => {
      const edge = element.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        barWidth: element.clientWidth,
        barScroll: element.scrollWidth,
        barHeight: edge.height,
        // a cell that wrapped would stand taller than the bar
        cellsInside: [...element.children].every((child) => {
          const cell = child.getBoundingClientRect();
          return cell.width === 0 || (cell.top >= edge.top && cell.bottom <= edge.bottom);
        }),
      };
    });
    expect(pageWidth).toBeLessThanOrEqual(400);
    expect(barScroll).toBeLessThanOrEqual(barWidth);
    expect(barHeight).toBeLessThan(40);
    expect(cellsInside).toBe(true);

    // the corner controls sit above the bar, not under it
    const barTop = (await bar.boundingBox())!.y;
    for (const name of ["Camera", "Day / night"]) {
      const box = (await page.getByRole("button", { name }).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(barTop);
    }
  });
});
