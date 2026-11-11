import { expect, test } from "@playwright/test";

import {
  assertNoHorizontalOverflow,
  findClippedText,
  findCroppedHeroImage,
  findDockOutsideViewport,
  findSmallTouchTargets,
  findUsesHeroIconProblems,
  preparePage,
  settlePage,
} from "./helpers";
import { ROUTES, VIEWPORTS } from "./routes";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  for (const route of ROUTES) {
    test(`no horizontal overflow on ${route} at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await preparePage(page, "light");
      await page.goto(route);
      await settlePage(page);
      await assertNoHorizontalOverflow(page);
    });
  }
}

for (const route of ROUTES) {
  test(`touch targets and text fit on ${route} at phone width`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await preparePage(page, "light");
    await page.goto(route);
    await settlePage(page);
    expect(await findSmallTouchTargets(page)).toEqual([]);
    expect(await findClippedText(page)).toEqual([]);
  });
}

function expectedPillHeight(width: number): number {
  if (width <= 360) return 48;
  return width < 640 ? 52 : 56;
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`header is plain at rest and a floating pill after scrolling with ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.route("**/api/stream-status", (handler) =>
      handler.fulfill({ json: { state: "offline" } }),
    );
    await page.goto("/");
    const header = page.locator(".site-header");
    const row = page.locator(".site-header-row");
    const readRow = () =>
      row.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          shadow: style.boxShadow,
          top: Math.round(box.top),
          height: Math.round(box.height),
        };
      });
    const headerHeight = () => header.evaluate((element) => element.getBoundingClientRect().height);
    const restingHeaderHeight = await headerHeight();
    const rest = await readRow();
    expect(rest.background).toBe("rgba(0, 0, 0, 0)");
    expect(rest.shadow).toBe("none");
    await page.evaluate(() => {
      globalThis.scrollTo(0, 400);
    });
    await expect
      .poll(() => row.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(16);
    const pill = await readRow();
    expect(pill.height).toBe(expectedPillHeight(page.viewportSize()?.width ?? 0));
    expect(pill.background).not.toMatch(/^rgba\(0, 0, 0, 0\)$|^transparent$/);
    expect(pill.shadow).not.toBe("none");
    expect(await headerHeight()).toBe(restingHeaderHeight);
    await page.evaluate(() => {
      globalThis.scrollTo(0, 0);
    });
    await expect
      .poll(() => row.evaluate((element) => getComputedStyle(element).boxShadow))
      .toBe("none");
  });
}

const DOCK_WIDTHS = [320, 360, 375, 390, 412, 430] as const;

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  for (const width of DOCK_WIDTHS) {
    test(`dock fits the viewport at ${String(width)} px with ${reducedMotion} motion`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await preparePage(page, "light");
      await page.emulateMedia({ reducedMotion });
      await page.goto("/");
      await settlePage(page);
      expect(await findDockOutsideViewport(page)).toEqual([]);
      for (const trigger of ["language", "theme"]) {
        await page.locator(`[data-dock-trigger="${trigger}"]`).click();
        await expect(page.locator("[data-dock-panel]")).toBeVisible();
        expect(await findDockOutsideViewport(page)).toEqual([]);
        await page.keyboard.press("Escape");
      }
    });
  }
}

for (const width of [641, 700, 701]) {
  test(`header height and pill style switch together at ${String(width)} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/api/stream-status", (handler) =>
      handler.fulfill({ json: { state: "offline" } }),
    );
    await page.goto("/");
    await page.evaluate(() => {
      globalThis.scrollTo(0, 400);
    });
    const row = page.locator(".site-header-row");
    await expect
      .poll(() => row.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(16);
    const metrics = await page.locator(".site-header").evaluate((element) => ({
      header: Math.round(element.getBoundingClientRect().height),
      pill: Math.round(
        element.querySelector(".site-header-row")?.getBoundingClientRect().height ?? 0,
      ),
    }));
    expect(metrics).toEqual({ header: 76, pill: 56 });
  });
}

test("header height and pill style both use the compact values below 640 px", async ({ page }) => {
  await page.setViewportSize({ width: 639, height: 800 });
  await page.route("**/api/stream-status", (handler) =>
    handler.fulfill({ json: { state: "offline" } }),
  );
  await page.goto("/");
  await page.evaluate(() => {
    globalThis.scrollTo(0, 400);
  });
  const row = page.locator(".site-header-row");
  await expect
    .poll(() => row.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
    .toBe(16);
  const header = await page
    .locator(".site-header")
    .evaluate((element) => Math.round(element.getBoundingClientRect().height));
  const pill = await row.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect({ header, pill }).toEqual({ header: 64, pill: 52 });
});

for (const path of ["/uses/", "/es/uses/"]) {
  for (const width of [320, 375, 430]) {
    test(`uses hero icons stay clear of the text and inside the card on ${path} at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await preparePage(page, "light");
      await page.goto(path);
      await settlePage(page);
      expect(await findUsesHeroIconProblems(page)).toEqual([]);
    });
  }
}

for (const product of ["snug", "animated-fluent-emojis", "json-flow"]) {
  test(`product hero shows the full image on /products/${product}/ at 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await preparePage(page, "light");
    await page.goto(`/products/${product}/`);
    await settlePage(page);
    await page
      .locator("[data-product-hero] picture img")
      .evaluate((image: HTMLImageElement) => image.decode());
    expect(await findCroppedHeroImage(page)).toEqual([]);
  });
}
