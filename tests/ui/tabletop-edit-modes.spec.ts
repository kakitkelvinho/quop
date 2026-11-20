import { expect, test } from "./checks";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function clickPart(page: Page, index: number) {
  const box = await page.locator(".builderLabel").nth(index).boundingBox();
  expect(box).not.toBeNull();
  // Labels sit above their parts in screen space. Top view keeps their X aligned.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height + 20);
}

async function topView(page: Page) {
  await page.getByRole("region", { name: "Light follows the table" }).getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Camera" }).click();
  await page.getByRole("menuitem", { name: /Top: Top view/ }).click();
}

test("traced light is the default and the URL fallback lasts one visit", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await expect(page.getByRole("region", { name: "Light", exact: true })).toBeVisible();

  await page.goto("builder/tabletop/?traced=0");
  await expect(page.getByRole("region", { name: "Light", exact: true })).toHaveCount(0);

  await page.goto("builder/tabletop/");
  await expect(page.getByRole("region", { name: "Light", exact: true })).toBeVisible();
});

test("a selected traced Beam keeps its width, opacity and arrow controls", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.locator(".builderLightList__beam").first().click();
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
  const rows = page.getByRole("region", { name: "Light", exact: true }).locator(".builderLightList__beam");
  await rows.first().click();
  await page.getByRole("button", { name: "Add stops" }).click();
  await expect(page.getByRole("button", { name: "Done adding stops" })).toBeVisible();
  await rows.nth(1).click();
  await expect(page.getByRole("button", { name: "Add stops" })).toBeVisible();
  await rows.first().click();
  await expect(page.getByRole("button", { name: "Add stops" })).toBeVisible();
});

test("Light reveals an unsaved route, saves it, and selects a check's Component", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("region", { name: "Light follows the table" }).getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const setup = {
    version: 21,
    components: [
      { id: "laser", type: "laser-source", position: [0, 100, 0], orientation: [0, 0, 0, 1] },
      { id: "stop", type: "beam-block", position: [200, 100, 0], orientation: [0, 0, 0, 1] },
    ],
    beams: [], connections: [], frames: [], groups: [],
  };
  await page.locator('input[type="file"]').setInputFiles({ name: "unsaved.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(setup)) });
  await page.getByRole("button", { name: "Replace the table" }).click();
  const light = page.getByRole("region", { name: "Light", exact: true });
  const route = light.locator(".builderLightList__route");
  await expect(route).toHaveCount(1);
  await expect(route).toContainText("not saved");
  const canvas = page.locator("canvas").first();
  const before = await canvas.screenshot();
  await route.hover();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await route.getByRole("button", { name: "Save" }).click();
  await expect(route).toContainText("Laser → Dump");
  await expect(route).not.toContainText("not saved");
  await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem("quop.builder.scene.v1")) || "{}").beams?.length).toBe(1);
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("quop.builder.scene.v1")))!);
  expect(saved.beams[0].path).toEqual(["laser", "stop"]);
  expect(saved.beams[0].color).toMatch(/^#/);
  await route.getByRole("button", { name: "Hide Laser → Dump" }).click();
  await expect(route.getByRole("button", { name: "Show Laser → Dump" })).toBeVisible();
  await route.getByRole("button", { name: "Show Laser → Dump" }).click();
  await route.getByRole("button", { name: "Blocked by stop" }).click();
  await expect(page.locator(".builderInspector")).toContainText("Beam block");
});

test("every saved Setup fixture opens with Light, including hand-drawn Beams", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  const json = page.getByRole("textbox", { name: "The setup, as JSON" });
  for (let version = 1; version <= 21; version++) {
    const fixture = readFileSync(`src/components/builder/setup-fixtures/setup-v${version}.json`);
    const expected = JSON.parse(fixture.toString()).components.length;
    await page.locator('input[type="file"]').setInputFiles({ name: `setup-v${version}.json`, mimeType: "application/json", buffer: fixture });
    await page.getByRole("button", { name: "Replace the table" }).click();
    await expect.poll(async () => JSON.parse(await json.inputValue()).components.length).toBe(expected);
    await expect(page.getByRole("region", { name: "Light", exact: true })).toBeVisible();
    if (version === 1) await expect(page.getByRole("heading", { name: "Hand-drawn Beams" })).toBeVisible();
  }
});
