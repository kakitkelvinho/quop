// Times the generic CSV plotter on a real file, step by step, in headless
// Chromium against the static export. Usage:
//   node browser.mjs <csv> [baseUrl] [--profile out.json]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(`${process.env.PW_DIR ?? "."}/`);
const { chromium } = require("playwright-core");

const csvPath = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:4317";
const profileOut = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : null;
const exe = process.env.CHROME ??
  "/Users/hok5/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__long.push(entry.duration);
  }).observe({ type: "longtask", buffered: true });
});
await page.goto(`${base}/plotters/generic-csv-plotter/`, { waitUntil: "networkidle" });
const cdp = await page.context().newCDPSession(page);

// settled = two frames painted and no long task for 300 ms
async function settle() {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let last = window.__long.length;
        let quiet = 0;
        const tick = () =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (window.__long.length === last) quiet += 1;
              else (last = window.__long.length), (quiet = 0);
              quiet >= 3 ? resolve() : setTimeout(tick, 100);
            }),
          );
        tick();
      }),
  );
}

async function step(label, action, { profile = false } = {}) {
  await settle();
  await page.evaluate(() => (window.__long = []));
  if (profile) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }
  const t0 = Date.now();
  await action();
  await settle();
  const wall = Date.now() - t0 - 300; // minus the quiet window
  const longTasks = await page.evaluate(() => window.__long.slice());
  const stats = await page.evaluate(() => ({
    dom: document.getElementsByTagName("*").length,
    inputs: document.querySelectorAll(".csvRoleRow input").length,
    status: document.querySelector(".resultCard")?.textContent,
    canvas: !!document.querySelector(".visualizerChartSurface canvas"),
  }));
  const busy = longTasks.reduce((a, b) => a + b, 0);
  console.log(
    `${label}: wall ~${wall} ms, long tasks ${longTasks.length} = ${busy.toFixed(0)} ms (max ${Math.max(0, ...longTasks).toFixed(0)}), dom ${stats.dom}, picker inputs ${stats.inputs}, status "${stats.status}", chart ${stats.canvas}`,
  );
  if (profile) {
    const { profile: cpu } = await cdp.send("Profiler.stop");
    if (profileOut) writeFileSync(profileOut, JSON.stringify(cpu));
  }
}

await step("load file (auto layout)", () => page.setInputFiles('input[type="file"]', csvPath), {
  profile: !!profileOut,
});
await step("Series in → columns", () => page.getByRole("radio", { name: "columns" }).check());
await step("Y off column_9", () => page.locator(".csvRoleRow").filter({ hasText: "column_9" }).getByRole("checkbox").uncheck());
await step("X → column_3", () => page.locator(".csvRoleRow").filter({ hasText: "column_3" }).getByRole("radio").check());
await step("X → Row number", () => page.locator(".csvRoleRow").filter({ hasText: "Row number" }).getByRole("radio").check());
await step("fold sidebar", () => page.locator(".visualizerSidebar button").first().click());
await step("unfold sidebar", () => page.locator(".visualizerSidebar button").first().click());
await step("Series in → rows", () => page.getByRole("radio", { name: "rows" }).check());

await browser.close();
