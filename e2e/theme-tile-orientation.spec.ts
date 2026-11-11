import { expect, test, type Page } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

test.use({ colorScheme: "light" });

const HYDRATION_DELAY_MS = 1500;
const PHONE_WIDTHS = [320, 375, 390, 430, 768];

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThemeLayout {
  tabs: Rect[];
  bar: Rect;
  clipped: boolean[];
  touchAction: string;
}

async function readThemeLayout(page: Page): Promise<ThemeLayout> {
  const tabs = await page.locator(".theme-tab").evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return {
        rect: { x, y, width, height },
        clipped: element.scrollWidth > element.clientWidth,
      };
    }),
  );
  const bar = page.locator("[data-theme-slider]");
  const touchAction = await bar.evaluate((element) => getComputedStyle(element).touchAction);
  const box = await bar.boundingBox();
  if (!box) throw new Error("the theme bar has no box");
  return {
    tabs: tabs.map((tab) => tab.rect),
    bar: box,
    clipped: tabs.map((tab) => tab.clipped),
    touchAction,
  };
}

async function openThemeTile(page: Page, width: number, path = "/"): Promise<void> {
  await preparePage(page, "light", "no-preference");
  await page.setViewportSize({ width, height: 844 });
  await page.goto(path);
  await settlePage(page);
  const slider = page.locator("[data-theme-slider]");
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toHaveAttribute("data-ready", "");
}

async function readDragLevel(page: Page): Promise<number> {
  return page
    .locator("[data-theme-slider]")
    .evaluate((element) => Number(element.style.getPropertyValue("--drag-level")));
}

async function barBox(page: Page): Promise<Rect> {
  const box = await page.locator("[data-theme-slider]").boundingBox();
  if (!box) throw new Error("the theme bar has no box");
  return box;
}

test.describe("theme tile orientation", () => {
  for (const width of PHONE_WIDTHS) {
    for (const path of ["/", "/es/"]) {
      test(`lays the tabs in one row over a horizontal bar at ${String(width)}px ${path}`, async ({
        page,
      }) => {
        await openThemeTile(page, width, path);
        await expect(page.locator("[data-theme-slider]")).toHaveAttribute(
          "aria-orientation",
          "horizontal",
        );
        const layout = await readThemeLayout(page);
        const [first, ...rest] = layout.tabs;
        if (!first) throw new Error("no tabs");
        for (const tab of rest) expect(tab.y).toBeCloseTo(first.y, 0);
        for (const tab of layout.tabs) {
          expect(tab.height).toBeGreaterThanOrEqual(44);
        }
        expect(layout.clipped).toEqual([false, false, false]);
        expect(layout.bar.height).toBeCloseTo(56, 0);
        expect(layout.bar.width).toBeGreaterThan(layout.bar.height * 3);
        const tabsBottom = first.y + first.height + 4;
        expect(layout.bar.y - tabsBottom).toBeCloseTo(12, 0);
        expect(layout.touchAction).toBe("pan-y");
      });
    }
  }

  for (const width of [1024, 1280]) {
    test(`keeps the tabs in a column beside a vertical bar at ${String(width)}px`, async ({
      page,
    }) => {
      await openThemeTile(page, width);
      await expect(page.locator("[data-theme-slider]")).toHaveAttribute(
        "aria-orientation",
        "vertical",
      );
      const layout = await readThemeLayout(page);
      const [first, second] = layout.tabs;
      if (!first || !second) throw new Error("no tabs");
      expect(second.y).toBeGreaterThan(first.y);
      expect(layout.bar.height).toBeGreaterThan(layout.bar.width);
      expect(layout.bar.x).toBeGreaterThan(first.x + first.width);
      expect(layout.touchAction).toBe("none");
    });
  }

  test("renders the horizontal layout before hydration without a jump", async ({ page }) => {
    await preparePage(page, "light", "no-preference");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(/\/_astro\/ThemeSlider/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
      await route.continue();
    });
    await page.goto("/");
    const slider = page.locator("[data-theme-slider]");
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).not.toHaveAttribute("data-ready", "");
    const before = await readThemeLayout(page);
    expect(before.bar.width).toBeGreaterThan(before.bar.height * 3);
    await slider.focus();
    await expect(slider).toHaveAttribute("data-ready", "");
    const after = await readThemeLayout(page);
    expect(after.bar).toEqual(before.bar);
    expect(after.tabs).toEqual(before.tabs);
  });
});

test.describe("horizontal theme bar", () => {
  test("a drag along X sets the level, left dark and right light", async ({ page }) => {
    await openThemeTile(page, 390);
    const slider = page.locator("[data-theme-slider]");
    const box = await barBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 4 });
    await expect(slider).toHaveAttribute("data-dragging", "true");
    const level = await readDragLevel(page);
    expect(level).toBeGreaterThan(24);
    expect(level).toBeLessThan(40);
    const fillScale = await page
      .locator(".theme-fill")
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
    expect(fillScale).toBeCloseTo(level / 100, 1);
    await page.mouse.up();
    await expect(slider).toHaveAttribute("data-stop", "dark");
  });

  test("overshoots by at most 8 percent past the light end and returns", async ({ page }) => {
    await openThemeTile(page, 390);
    const slider = page.locator("[data-theme-slider]");
    const box = await barBox(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 120, y, { steps: 4 });
    const level = await readDragLevel(page);
    expect(level).toBeGreaterThan(100);
    expect(level).toBeLessThanOrEqual(108);
    await page.mouse.up();
    await expect(slider).toHaveAttribute("data-stop", "light");
    await expect(slider).toHaveAttribute("data-dragging", "false");
  });

  test("Left and Right step the bar, Up and Down still work", async ({ page }) => {
    await openThemeTile(page, 390);
    const slider = page.locator("[data-theme-slider]");
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await page.keyboard.press("ArrowUp");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("ArrowDown");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
  });

  test("a vertical swipe that starts on the bar scrolls the page", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      colorScheme: "light",
    });
    const page = await context.newPage();
    await openThemeTile(page, 390);
    const slider = page.locator("[data-theme-slider]");
    const box = await barBox(page);
    const startScroll = await page.evaluate(() => globalThis.scrollY);
    const startStop = await slider.getAttribute("data-stop");
    const session = await context.newCDPSession(page);
    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });
    for (let step = 1; step <= 10; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY + step * 15 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBeLessThan(startScroll);
    await expect(slider).toHaveAttribute("data-stop", startStop ?? "light");
    await context.close();
  });
});
