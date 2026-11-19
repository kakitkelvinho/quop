import { expect, test } from "./checks";
import type { Page } from "@playwright/test";

async function clickPart(page: Page, index: number) {
  const box = await page.locator(".builderLabel").nth(index).boundingBox();
  expect(box).not.toBeNull();
  // Labels sit above their parts in screen space. Top view keeps their X aligned.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height + 20);
}

async function topView(page: Page) {
  await page.getByRole("button", { name: "Camera" }).click();
  await page.getByRole("menuitem", { name: /Top: Top view/ }).click();
}

test("traced light is the default and the drawn fallback lasts one visit", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await expect(page.getByLabel("Traced Beam checks")).toBeVisible();
  await expect(page.getByLabel("Traced Beam checks")).toContainText("No checks");

  await page.goto("builder/tabletop/?traced=0");
  await expect(page.getByLabel("Traced Beam checks")).toHaveCount(0);

  await page.goto("builder/tabletop/");
  await expect(page.getByLabel("Traced Beam checks")).toBeVisible();
});

test("a selected traced Beam keeps its width, opacity and arrow controls", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.locator(".builderBeamRow__select").first().click();
  const width = page.getByRole("slider", { name: /Width/ });
  const opacity = page.getByRole("slider", { name: /Opacity/ });
  await expect(width).toBeVisible();
  await expect(opacity).toBeVisible();
  await width.press("End");
  await expect(width).toHaveValue("10");
  await opacity.press("Home");
  await expect(opacity).toHaveValue("0.1");
  await page.getByRole("button", { name: "No arrow" }).click();
  await expect(page.getByRole("button", { name: "No arrow" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Traced length")).toBeVisible();
});

test("the Flip keycap acts on the selected Mirror without dismissing it", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const label = await page.locator(".builderLabel").filter({ hasText: "Mirror" }).boundingBox();
  expect(label).not.toBeNull();
  await page.mouse.click(label!.x + label!.width / 2, label!.y + label!.height + 65);
  const hint = page.getByRole("button", { name: "Flip Mirror" });
  await expect(hint).toBeVisible();
  await hint.click();
  await expect(page.getByRole("heading", { name: "Mirror" })).toBeVisible();
  await expect(hint).toBeVisible();
});

test("switching drawing tools discards the previous draft", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await topView(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Beam: Draw a beam/ }).click();
  await expect(page.getByRole("heading", { name: "New beam" })).toBeVisible();

  // The example has labelled parts; click one to leave an unfinished beam.
  await clickPart(page, 0);
  await expect(page.getByText("1 stop", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Draw a frame" }).click();
  await expect(page.getByRole("heading", { name: "New beam" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Stop drawing the frame" })).toBeVisible();
  await page.getByRole("button", { name: "Stop adding" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Cable: Connect two parts/ }).click();
  await expect(page.getByRole("heading", { name: "New fibre" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop drawing the frame" })).toBeHidden();
  await clickPart(page, 0);
  await expect(page.getByText(/From /)).toBeVisible();
  await clickPart(page, 1);
  await expect(page.getByRole("heading", { name: "New fibre" })).toBeHidden();
  await expect(page.getByText("Fibre added.")).toBeVisible();
});

test("Escape cancels Place before closing Parts", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Part: Open the parts panel/ }).click();
  const parts = page.getByRole("complementary", { name: "Parts" });
  const kind = parts.locator(".builderPart").first();
  await kind.click();
  await expect(kind).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(kind).toHaveAttribute("aria-pressed", "false");
  await expect(parts).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(parts).toBeHidden();
});

test("placing one part keeps Parts open and saves one component", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /Clear: Empty the table/ }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Part: Open the parts panel/ }).click();
  const parts = page.getByRole("complementary", { name: "Parts" });
  const kind = parts.locator(".builderPart").first();
  await kind.click();
  const canvas = await page.locator(".builderCanvasHost canvas").boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.click(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);
  await expect(kind).toHaveAttribute("aria-pressed", "false");
  await expect(parts).toBeVisible();
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const json = page.getByRole("textbox", { name: "The setup, as JSON" });
  await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(0);
});

test("clearing the setup cancels a drawing tool", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "Draw a frame" }).click();
  await expect(page.getByRole("button", { name: "Stop drawing the frame" })).toBeVisible();
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /Clear: Empty the table/ }).click();
  await expect(page.getByRole("button", { name: "Stop drawing the frame" })).toBeHidden();
  await expect(page.getByText("Table cleared. ⌘Z undoes.")).toBeVisible();
});

test("replacing the setup clears Place", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Part: Open the parts panel/ }).click();
  const kind = page.getByRole("complementary", { name: "Parts" }).locator(".builderPart").first();
  await kind.click();
  await expect(kind).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const json = page.getByRole("textbox", { name: "The setup, as JSON" });
  const original = JSON.parse(await json.inputValue());
  await page.locator('input[type="file"]').setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...original, components: [], beams: [], connections: [] })),
  });
  await page.getByRole("button", { name: "Replace the table" }).click();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(0);
});

test("Add stops ends when another beam is selected", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const rows = page.getByRole("region", { name: "Beams" }).locator(".builderBeamRow__select");
  await rows.first().click();
  await page.getByRole("button", { name: "Add stops" }).click();
  await expect(page.getByRole("button", { name: "Done adding stops" })).toBeVisible();
  await rows.nth(1).click();
  await expect(page.getByRole("button", { name: "Add stops" })).toBeVisible();
  await rows.first().click();
  await expect(page.getByRole("button", { name: "Add stops" })).toBeVisible();
});
