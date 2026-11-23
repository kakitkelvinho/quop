import { expect, test } from "./checks";
import { readFileSync } from "node:fs";

const statusBar = (page: import("@playwright/test").Page) => page.getByRole("toolbar", { name: "Tabletop status" });

test("what's new appears once and can open the earlier view", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const card = page.getByRole("region", { name: "Light follows the table" });
  await expect(card).toBeVisible();
  const gotItColors = await card.getByRole("button", { name: "Got it" }).evaluate((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, text: style.color };
  });
  expect(gotItColors.text).not.toBe(gotItColors.background);
  await expect(card).toContainText("Hand-drawn Beams are still there, and older Setups still work.");
  await card.getByRole("button", { name: "Use earlier view" }).click();
  await expect(card).toHaveCount(0);
  await expect(statusBar(page)).toContainText("Legacy view: drawn Beams, not traced");
  await page.reload();
  await expect(card).toHaveCount(0);
  await expect(statusBar(page)).toContainText("Legacy view: drawn Beams, not traced");
  await page.goto("builder/tabletop/");
  await expect(statusBar(page)).toContainText("Legacy view: drawn Beams, not traced");
});

test("mode hints move to the bar and Select shows at rest", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const bar = statusBar(page);
  await expect(bar.locator(".builderStatusBar__mode")).toContainText("Select");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: /Part: Open the parts panel/ }).click();
  await page.getByRole("complementary", { name: "Parts" }).locator(".builderPart").first().click();
  await expect(bar.locator(".builderStatusBar__mode")).toContainText("place");
  await expect(bar.locator(".builderStatusBar__mode kbd")).toContainText(["Click", "Esc"]);
});

test("checks popover closes with Esc and selects its Component", async ({ page }) => {
  await page.goto("builder/tabletop/");
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
  await page.locator('input[type="file"]').setInputFiles({ name: "blocked.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(setup)) });
  await page.getByRole("button", { name: "Replace the table" }).click();
  const checks = statusBar(page).getByRole("button", { name: /check/ });
  await expect(checks).toHaveAccessibleName("1 check");
  await checks.hover();
  await expect(page.getByRole("dialog", { name: "Checks" })).toContainText("Blocked by stop");
  await checks.click();
  await expect(page.getByRole("dialog", { name: "Checks" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Checks" })).toHaveCount(0);
  await checks.click();
  await page.getByRole("dialog", { name: "Checks" }).getByRole("button", { name: "Blocked by stop" }).click();
  await expect(page.locator(".builderInspector")).toContainText("Beam block");
  await expect(page.getByRole("dialog", { name: "Checks" })).toHaveCount(0);
});

test("Legacy switch and back keep query settings and the page view", async ({ page }) => {
  await page.goto("builder/tabletop/?foo=bar");
  await page.getByRole("region", { name: "Light follows the table" }).getByRole("button", { name: "Got it" }).click();
  await page.getByRole("button", { name: "Camera" }).click();
  await page.getByRole("menuitem", { name: /Top: Top view/ }).click();
  const bar = statusBar(page);
  await expect(bar.getByRole("group", { name: "Light view" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Light", exact: true }).getByRole("meter", { name: "Power" }).first()).toBeVisible();
  await bar.getByRole("button", { name: "Legacy view" }).click();
  await expect(bar).toContainText("Legacy view: drawn Beams, not traced");
  await expect(page).toHaveURL(/foo=bar.*traced=0/);
  await expect(page.getByRole("region", { name: "Light", exact: true })).toHaveCount(0);
  await bar.getByRole("button", { name: "Switch to traced Beams" }).click();
  await expect(page).toHaveURL(/foo=bar/);
  await expect(page).not.toHaveURL(/traced=0/);
  await expect(page.getByRole("region", { name: "Light", exact: true }).getByRole("meter", { name: "Power" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Camera" })).toHaveAttribute("title", "Camera: top");
});

test("the 400 px bar has no wrapping or overlapping controls", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto("builder/tabletop/");
  const bar = statusBar(page);
  await expect(bar).toBeVisible();
  await expect(bar.locator(".builderStatusBar__mode")).toBeHidden();
  const measure = () => bar.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    children: [...element.children].filter((child) => getComputedStyle(child).display !== "none" && child.getBoundingClientRect().width > 0).map((child) => ({
      left: child.getBoundingClientRect().left,
      right: child.getBoundingClientRect().right,
      height: child.getBoundingClientRect().height,
    })),
  }));
  const geometry = await measure();
  expect(geometry.width).toBe(400);
  for (let at = 1; at < geometry.children.length; at++) expect(geometry.children[at].left).toBeGreaterThanOrEqual(geometry.children[at - 1].right - 1);
  expect(geometry.children.every((child) => child.height <= geometry.height)).toBe(true);
  await bar.getByRole("button", { name: "Legacy view" }).click();
  await expect(bar.getByRole("button", { name: "Switch to traced Beams" })).toBeVisible();
  const legacy = await measure();
  for (let at = 1; at < legacy.children.length; at++) expect(legacy.children[at].left).toBeGreaterThanOrEqual(legacy.children[at - 1].right - 1);
  expect(legacy.children.every((child) => child.height <= legacy.height)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
});

test("an upgraded Setup keeps its notice in the bar", async ({ page }) => {
  await page.goto("builder/tabletop/");
  await page.getByRole("button", { name: "QUOP" }).click();
  await page.getByRole("menuitem", { name: /^\.json/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "setup-v1.json", mimeType: "application/json",
    buffer: readFileSync("src/components/builder/setup-fixtures/setup-v1.json"),
  });
  await page.getByRole("button", { name: "Replace the table" }).click();
  await expect(statusBar(page).locator(".builderStatusBar__upgrade")).toContainText("Upgraded");
  await expect(statusBar(page).locator(".builderStatusBar__upgrade")).toHaveAttribute("aria-label", /This file was upgraded/);
});

test("the look picker switches to 2001, survives a reload, and leaves the rest of the site alone", async ({ page }) => {
  await page.goto("builder/tabletop/");
  const look = statusBar(page).getByRole("group", { name: "Look" });
  await expect(look.getByRole("button", { name: "Station" })).toHaveAttribute("aria-pressed", "true");
  await look.getByRole("button", { name: "2001" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "2001");
  await page.reload();
  await expect(statusBar(page).getByRole("group", { name: "Look" }).getByRole("button", { name: "2001" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("calculators/");
  await expect(page.locator("html")).not.toHaveAttribute("data-look", /.+/);
});
