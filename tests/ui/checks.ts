import { expect, test as base } from "@playwright/test";

/**
 * Playwright's `test`, with two checks added to every test: the page shows
 * the theme of the project being run (light or dark, see
 * playwright.config.ts), and nothing on the page threw an error.
 */
export const test = base.extend<{ pageChecks: void }>({
  pageChecks: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      await expect(page.locator("html")).toHaveAttribute("data-theme", testInfo.project.name);
      expect(errors, "errors thrown on the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
