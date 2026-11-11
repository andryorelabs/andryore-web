import { expect, test, type Page } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

test.use({ colorScheme: "light" });

const HYDRATION_DELAY_MS = 1500;

async function openWithMotion(page: Page): Promise<void> {
  await preparePage(page, "light");
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
}

async function readTransition(
  page: Page,
  selector: string,
): Promise<{
  properties: string[];
  durations: string[];
  easings: string[];
}> {
  return page.locator(selector).evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      properties: style.transitionProperty.split(",").map((p) => p.trim()),
      durations: style.transitionDuration.split(",").map((d) => d.trim()),
      easings: style.transitionTimingFunction
        .split(/,\s*(?![^()]*\))/)
        .map((easing) => easing.trim()),
    };
  });
}

async function pressBar(page: Page, ratio: number): Promise<void> {
  const bar = page.locator("[data-theme-slider]");
  await bar.scrollIntoViewIfNeeded();
  const box = await bar.boundingBox();
  if (!box) throw new Error("the theme bar has no box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * ratio);
}

test.describe("theme tile motion", () => {
  test("moves the fill and the sun with transform and one spring", async ({ page }) => {
    await openWithMotion(page);
    await page.goto("/");
    await settlePage(page);
    const motion = {
      fill: await readTransition(page, ".theme-fill"),
      sun: await readTransition(page, ".theme-sun"),
      indicator: await readTransition(page, ".theme-indicator"),
    };
    for (const part of Object.values(motion)) {
      for (const layout of ["height", "width", "top", "all"]) {
        expect(part.properties).not.toContain(layout);
      }
      for (const [position, property] of part.properties.entries()) {
        if (!["transform", "rotate", "scale"].includes(property)) continue;

        expect(part.durations[position]).toBe("0.52s");
        expect(part.easings[position]).toContain("linear(");
      }
    }
    expect(motion.fill.properties).toContain("transform");
    expect(motion.sun.properties).toEqual(expect.arrayContaining(["rotate", "scale"]));
    expect(motion.indicator.properties).toContain("transform");
  });

  test("a drag follows the pointer continuously and settles on release", async ({ page }) => {
    await openWithMotion(page);
    await page.goto("/");
    await settlePage(page);
    const slider = page.locator("[data-theme-slider]");
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    if (!box) throw new Error("the theme bar has no box");
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height * 0.3, { steps: 4 });
    await expect(slider).toHaveAttribute("data-dragging", "true");
    const level = await slider.evaluate((element) =>
      Number(element.style.getPropertyValue("--drag-level")),
    );
    expect([24, 62, 100]).not.toContain(Math.round(level));
    expect(level).toBeGreaterThan(60);
    expect(level).toBeLessThan(80);
    const fillScale = await page
      .locator(".theme-fill")
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).d);
    expect(fillScale).toBeCloseTo(level / 100, 1);
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await expect(slider).toHaveAttribute("data-stop", "light");
    await page.mouse.up();
    await expect(slider).toHaveAttribute("data-dragging", "false");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await expect(slider).toHaveAttribute("data-stop", "auto");
  });

  test("pulling past the top overshoots by at most 8 percent and returns", async ({ page }) => {
    await openWithMotion(page);
    await page.goto("/");
    await settlePage(page);
    const slider = page.locator("[data-theme-slider]");
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    if (!box) throw new Error("the theme bar has no box");
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(x, box.y - box.height, { steps: 4 });
    const level = await slider.evaluate((element) =>
      Number(element.style.getPropertyValue("--drag-level")),
    );
    expect(level).toBeGreaterThan(100);
    expect(level).toBeLessThanOrEqual(108);
    await page.mouse.up();
    await expect(slider).toHaveAttribute("data-stop", "light");
    await expect(slider).toHaveAttribute("data-dragging", "false");
    expect(await slider.evaluate((element) => element.style.getPropertyValue("--drag-level"))).toBe(
      "",
    );
  });

  test("a tab click and a bar press both change the stop", async ({ page }) => {
    await openWithMotion(page);
    await page.goto("/");
    await settlePage(page);
    const slider = page.locator("[data-theme-slider]");
    await page.locator('[data-tab="dark"]').click();
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await pressBar(page, 0.1);
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await pressBar(page, 0.5);
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
  });

  test("keeps other transitions while the theme fades", async ({ page }) => {
    await openWithMotion(page);
    await page.goto("/");
    await settlePage(page);
    await page.locator('[data-tab="dark"]').click();
    await expect(page.locator("html")).toHaveClass(/theme-fade/);
    const tab = await readTransition(page, ".theme-tab >> nth=0");
    const properties = tab.properties;
    expect(properties).toContain("scale");
  });

  test("the first press on the bar before hydration is not lost", async ({ page }) => {
    await openWithMotion(page);
    await page.route(/\/_astro\/ThemeSlider/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
      await route.continue();
    });
    await page.goto("/");
    const slider = page.locator("[data-theme-slider]");
    await expect(slider).not.toHaveAttribute("data-ready", "");
    await pressBar(page, 0.9);
    await expect(slider).toHaveAttribute("data-ready", "");
    await expect(slider).toHaveAttribute("aria-valuenow", "2");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
