import { expect, test } from "@playwright/test";

import { settlePage } from "./helpers";
import { languageOf, streamMessages } from "./messages";

const HOME_ROUTES = ["/", "/es/"] as const;

for (const route of HOME_ROUTES) {
  const copy = streamMessages(languageOf(route));

  test.describe(`stream tile on ${route}`, () => {
    test("shows the live state with the stream title", async ({ page }) => {
      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({
          json: { state: "live", title: "Building the site" },
        }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-stream-tile]");
      await expect(tile).toHaveAttribute("data-state", "live");
      await expect(tile.getByText(copy.liveTag)).toBeVisible();
      await expect(tile.getByRole("link", { name: copy.watch })).toBeVisible();
      await expect(tile.locator("[data-stream-title]")).toHaveText("Building the site");
      await expect(tile.getByText(copy.comingSoon)).toBeHidden();
    });

    test("shows the coming-soon slate when the channel is offline", async ({ page }) => {
      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({ json: { state: "offline" } }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-stream-tile]");
      await expect(tile.getByText(copy.comingSoon)).toBeVisible();
      await expect(tile.getByText(copy.planned)).toBeVisible();
      await expect(tile.getByText(copy.plannedLabel, { exact: true })).toBeVisible();
      await expect(tile.getByText(copy.plannedValue, { exact: true })).toBeVisible();
      await expect(tile.getByRole("list", { name: copy.weekLabel })).toBeVisible();
    });

    test("shows the fallback caption and no week strip when live without a title", async ({
      page,
    }) => {
      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({ json: { state: "live", title: "" } }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-stream-tile]");
      await expect(tile.getByText(copy.liveCaption)).toBeVisible();
      await expect(tile.locator(".stream-week")).toBeHidden();
    });

    test("outlines today in the week row", async ({ page }) => {
      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({ json: { state: "offline" } }),
      );
      await page.goto(route);
      await settlePage(page);
      await expect(page.locator('[data-stream-day][data-today="true"]')).toHaveCount(1);
    });

    test("keeps the coming-soon slate when the endpoint fails", async ({ page }) => {
      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({ status: 500, body: "upstream error" }),
      );
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-stream-tile]");
      await expect(tile.getByText(copy.comingSoon)).toBeVisible();
    });
  });
}
