import { expect, test } from "./checks";

test("AI brief opens on the right side of the table", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "Help" }).click();
  await page.getByRole("menuitem", { name: /AI brief/ }).click();
  const brief = page.locator('[data-panel="brief"]');
  await expect(brief).toBeVisible();
  const box = await brief.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width / 2).toBeGreaterThan(640);
});

test("replacing from a file updates the table immediately", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const json = page.getByRole("textbox", { name: "The setup, as JSON" });
  const original = JSON.parse(await json.inputValue());
  expect(original.components.length).toBeGreaterThan(0);
  const replacement = { ...original, components: [], beams: [], connections: [] };
  await page.locator('input[type="file"]').setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page.getByRole("button", { name: "Replace the table" }).click();
  await expect(page.locator("#builder-json-check")).toContainText("Live: 0 parts");
  await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(original.components.length);
});
