import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

const EMAIL = "hello@andryore.dev";

test.describe("find me band", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy puts the address on the clipboard and confirms it", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/");
    await settlePage(page);
    const chip = page.locator("[data-email-chip]");
    await chip.scrollIntoViewIfNeeded();
    await chip.locator("[data-copy-email]").click();
    await expect(chip.getByRole("status")).toHaveText("Copied");
    const copied = await page.evaluate(() => globalThis.navigator.clipboard.readText());
    expect(copied).toBe(EMAIL);
  });

  test("send opens a mailto link for the address", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/");
    await expect(page.locator("[data-send-email]")).toHaveAttribute("href", `mailto:${EMAIL}`);
  });

  for (const [name, viewport] of [
    ["phone", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ] as const) {
    test(`the dock does not cover the find me band at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await preparePage(page, "light");
      await page.goto("/");
      await settlePage(page);
      await page.evaluate(() => {
        globalThis.scrollTo(0, globalThis.document.body.scrollHeight);
      });
      const gap = await page.evaluate(() => {
        const band = globalThis.document.querySelector("#find-me");
        const dock = globalThis.document.querySelector("[data-dock-slot] nav");
        return !band || !dock
          ? NaN
          : dock.getBoundingClientRect().top - band.getBoundingClientRect().bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(-0.5);
    });
  }
});
