import { defineConfig } from "@playwright/test";

import nextConfig from "./next.config";

// The tests open the static export in out/, the same files GitHub Pages
// serves. `npm run test:ui` builds it first. On GitHub Actions next.config.ts
// builds under /quop, so the server and the tests use that path too.
const basePath = nextConfig.basePath ?? "";
const port = 3100;

export default defineConfig({
  testDir: "tests/ui",
  // CI fails if a test.only was left in
  forbidOnly: !!process.env.CI,
  // progress in the terminal, and a report with screenshot diffs in playwright-report/
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    // software-drawn screenshots of long pages can take a while
    timeout: 30_000,
    // A pixel counts as changed when its colour moves by more than
    // `threshold` (0 to 1; Playwright's default is 0.2), and a screenshot
    // may have at most 0.1% of its pixels changed. Loose enough for text
    // anti-aliasing, tight enough that recolouring one nav tab fails.
    toHaveScreenshot: { threshold: 0.1, maxDiffPixelRatio: 0.001, animations: "disabled" },
  },
  use: {
    browserName: "chromium",
    // Draw WebGL (the Builder's 3D table) in software. Without this, every
    // screenshot taken in the same browser after the Builder test fails.
    launchOptions: { args: ["--use-angle=swiftshader"] },
    baseURL: `http://localhost:${port}${basePath}/`,
    viewport: { width: 1280, height: 900 },
    // the homepage's chalk and scroll animations hold still when motion is reduced
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  // Every test runs twice, once per theme. The site follows the system theme
  // until someone picks one, so colorScheme sets html[data-theme].
  projects: [
    { name: "light", use: { colorScheme: "light" } },
    { name: "dark", use: { colorScheme: "dark" } },
  ],
  webServer: {
    command: "node scripts/serve-out.mjs",
    env: { PORT: String(port), BASE_PATH: basePath },
    url: `http://localhost:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
  },
});
