import { expect, test } from "@playwright/test";

import { settlePage } from "./helpers";
import { languageOf } from "./messages";

const HOME_ROUTES = ["/", "/es/"] as const;

const liveGrid = {
  capturedAt: "2026-10-18",
  updatedAt: new Date().toISOString(),
  total: 4321,
  weeks: [
    [
      { date: "2026-10-15", count: 0, level: 0 },
      { date: "2026-10-16", count: 3, level: 2 },
      { date: "2026-10-17", count: 9, level: 4 },
      { date: "2026-10-18", count: 1, level: 1 },
    ],
  ],
};

for (const route of HOME_ROUTES) {
  const language = languageOf(route);

  test.describe(`github tile on ${route}`, () => {
    test("renders the live grid and stats from the endpoint", async ({ page }) => {
      await page.route("**/api/github-contributions", (handler) =>
        handler.fulfill({ json: liveGrid }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-github-grid]");
      await expect(tile.locator("[data-gh-grid] i")).toHaveCount(4);
      await expect(tile.locator("[data-gh-grid] i").first()).toHaveAttribute(
        "data-tip",
        language === "es" ? /contribuci/ : /contribution/,
      );
      await expect(tile.locator('[data-gh-stat="best"]')).toHaveText("9");
      await expect(tile.locator('[data-gh-stat="longest"]')).toHaveText("3");
      await expect(tile.locator('[data-gh-stat="longest-unit"]')).toHaveText(
        language === "es" ? "días" : "days",
      );
      await expect(tile.locator("[data-count-total]")).toHaveText(
        language === "es" ? "4.321" : "4,321",
      );
      await expect(tile.locator("[data-gh-updated]")).toHaveText(
        language === "es" ? /^Actualizado / : /^Updated /,
      );
    });

    test("keeps the build snapshot when the endpoint fails", async ({ page }) => {
      await page.route("**/api/github-contributions", (handler) =>
        handler.fulfill({ status: 503, body: "unavailable" }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-github-grid]");
      await expect(tile).toBeVisible();
      expect(await tile.locator("[data-gh-grid] i").count()).toBeGreaterThan(50);
      await expect(tile.locator("[data-gh-updated]")).toHaveText(
        language === "es" ? /^Actualizado / : /^Updated /,
      );
    });
  });
}

test.describe("github tile touch and keyboard access", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });

  test("tapping a cell shows its tip and tapping elsewhere hides it", async ({ page }) => {
    await page.route("**/api/github-contributions", (handler) =>
      handler.fulfill({ json: liveGrid }),
    );
    await page.goto("/");
    await settlePage(page);
    const cells = page.locator("[data-github-grid] [data-gh-grid] i");
    await expect(cells).toHaveCount(4);
    const cell = cells.nth(2);
    await cell.scrollIntoViewIfNeeded();
    await cell.tap();
    await expect(cell).toHaveAttribute("data-active");
    const tip = await cell.evaluate((element) => getComputedStyle(element, "::after").content);
    expect(tip).toContain("9");
    await page.locator("h1").first().tap();
    await expect(cell).not.toHaveAttribute("data-active");
  });

  test("keyboard focus shows a tip and arrows move it", async ({ page }) => {
    await page.route("**/api/github-contributions", (handler) =>
      handler.fulfill({ json: liveGrid }),
    );
    await page.goto("/");
    await settlePage(page);
    const grid = page.locator("[data-github-grid] [data-gh-grid]");
    const cells = grid.locator("i");
    await expect(cells).toHaveCount(4);
    await grid.focus();
    await expect(cells.nth(0)).toHaveAttribute("data-active");
    await page.keyboard.press("ArrowDown");
    await expect(cells.nth(1)).toHaveAttribute("data-active");
    await expect(cells.nth(0)).not.toHaveAttribute("data-active");
    await grid.blur();
    await expect(cells.nth(1)).not.toHaveAttribute("data-active");
  });
});

test.describe("github month labels on phones", () => {
  for (const width of [320, 375, 430]) {
    test(`do not overlap at ${String(width)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await settlePage(page);
      const boxes = await page.locator(".github-months li:visible").evaluateAll((items) =>
        items.map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item);
          const { left, right } = range.getBoundingClientRect();
          return { left, right };
        }),
      );
      expect(boxes.length).toBeGreaterThan(2);
      for (const [index, box] of boxes.entries()) {
        const next = boxes[index + 1];
        if (next) expect(box.right).toBeLessThanOrEqual(next.left);
      }
    });
  }
});
