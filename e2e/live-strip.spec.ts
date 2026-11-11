import { expect, test } from "@playwright/test";

import { SOUND_FILES } from "../src/lib/sound-engine";
import { preparePage, settlePage } from "./helpers";
import { chromeMessages, languageOf, streamMessages } from "./messages";

const FX_STORAGE_KEY = "ao-fx2";

test.describe("live strip", () => {
  test("theme slider steps through Light, Auto and Dark by keyboard", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/");
    await settlePage(page);
    const copy = chromeMessages("en").theme;
    const slider = page.locator("[data-theme-slider]");
    await expect(slider).toHaveAttribute("role", "slider");
    await expect(slider).toHaveAttribute("aria-valuetext", copy.light);
    await slider.focus();
    await page.keyboard.press("ArrowDown");
    await expect(slider).toHaveAttribute("aria-valuetext", copy.auto);
    await page.keyboard.press("ArrowDown");
    await expect(slider).toHaveAttribute("aria-valuetext", copy.dark);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.keyboard.press("ArrowDown");
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(slider).toHaveAttribute("aria-valuetext", copy.light);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("language pill switches the locale route", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/");
    await settlePage(page);
    const tile = page.locator("[data-language-tile]");
    await expect(tile.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await tile.getByRole("link", { name: "Español" }).click();
    await expect(page).toHaveURL(/\/es\/$/);
    await expect(
      page.locator("[data-language-tile]").getByRole("link", { name: "Español" }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("language, fx and theme tiles match the canvas values", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/");
    await settlePage(page);
    const language = await page
      .locator("[data-language-tabs] a")
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return [style.fontWeight, style.fontSize, style.minHeight];
      });
    expect(language).toEqual(["700", "13px", "44px"]);
    const fxSwitch = await page.locator("[data-fx-switch] .fx-switch").evaluate((node) => {
      const box = node.getBoundingClientRect();
      return [box.width, box.height];
    });
    expect(fxSwitch).toEqual([56, 32]);
    const themeTab = await page
      .locator(".theme-tab")
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return [style.flexDirection, style.fontSize, style.fontWeight];
      });
    expect(themeTab).toEqual(["column", "13px", "700"]);
  });

  test("sound switch toggles aria-checked and persists across reload", async ({ page }) => {
    await page.route("**/sounds/manifest.json", (route) =>
      route.fulfill({ json: { sounds: [...SOUND_FILES] } }),
    );
    await preparePage(page, "light");
    await page.goto("/");
    await settlePage(page);
    const fx = page.locator("[data-fx-switch]");
    const dockSwitch = page.getByRole("navigation").getByRole("switch");
    await expect(fx).toHaveAttribute("aria-checked", "false");
    await fx.click();
    await expect(fx).toHaveAttribute("aria-checked", "true");
    await expect(dockSwitch).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate((key) => globalThis.localStorage.getItem(key), FX_STORAGE_KEY)).toBe(
      "on",
    );
    await page.reload();
    await settlePage(page);
    await expect(page.locator("[data-fx-switch]")).toHaveAttribute("aria-checked", "true");
  });

  for (const route of ["/", "/es/"] as const) {
    test(`stream tile shows the slate, then live, on ${route}`, async ({ page }) => {
      const copy = streamMessages(languageOf(route));
      await preparePage(page, "light");
      await page.goto(route);
      await settlePage(page);
      const tile = page.locator("[data-stream-tile]");
      await expect(tile).toHaveAttribute("data-state", "coming-soon");
      await expect(tile.getByText(copy.comingSoon)).toBeVisible();
      await expect(tile.getByText(copy.planned)).toBeVisible();

      await page.route("**/api/stream-status", (handler) =>
        handler.fulfill({ json: { state: "live", title: "Building" } }),
      );
      await page.reload();
      await settlePage(page);
      await expect(page.locator("[data-stream-title]")).toHaveText("Building");
      await expect(page.locator("[data-stream-tile]")).toHaveAttribute("data-state", "live");
      await expect(page.locator("[data-stream-tile]").getByText(copy.liveTag)).toBeVisible();
    });
  }
});
