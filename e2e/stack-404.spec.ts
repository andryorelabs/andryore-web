import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

const NOT_FOUND_PAGES = [
  {
    path: "/does-not-exist/",
    heading: /wandered off/,
    message: /It is not here/,
    home: "/",
    products: "/#products",
  },
  {
    path: "/es/404/",
    heading: /se fue por ahí/,
    message: /No está aquí/,
    home: "/es/",
    products: "/es/#products",
  },
] as const;

for (const page of NOT_FOUND_PAGES) {
  test(`${page.path} renders the 404 with working Home and Products links`, async ({
    page: browserPage,
  }) => {
    await preparePage(browserPage, "light");
    await browserPage.goto(page.path);
    await expect(browserPage.getByRole("heading", { level: 1, name: page.heading })).toBeVisible();
    await expect(browserPage.getByText(page.message)).toBeVisible();
    const links = browserPage.locator(".nf-stage a");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", page.home);
    await expect(links.nth(1)).toHaveAttribute("href", page.products);
    await links.nth(0).click();
    await expect(browserPage).toHaveURL(new RegExp(`${page.home}$`));
  });
}

test("with reduced motion the Stack CTA is visible without scrolling the stage", async ({
  page,
}) => {
  await preparePage(page, "dark");
  await page.goto("/");
  await settlePage(page);
  const link = page.locator(".stack-cta-link");
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await expect(page.locator(".stack-cta")).toHaveCSS("opacity", "1");
  await expect(link).toHaveAttribute("href", "/uses/");
  await expect(page.locator('.stack-tile[aria-hidden="true"]').first()).toBeAttached();
  await expect(page.locator(".stack-scene a")).toHaveCount(1);
  await expect(page.locator(".stack-stage")).toHaveCSS("height", "760px");
  await expect(page.locator(".stack-scene")).not.toHaveCSS("height", "2000px");
  await expect(page.locator(".stack-tile-scatter").first()).toHaveCSS("rotate", "-8deg");
  await expect(page.locator(".stack-title")).toHaveCSS("opacity", "1");
});

for (const route of ["/does-not-exist/", "/es/404/"]) {
  test(`${route} keeps the 12 tiles at their canvas spots and off the content at 390px`, async ({
    page,
  }) => {
    await preparePage(page, "light");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await settlePage(page);
    await expect(page.locator(".nf-tile")).toHaveCount(12);
    await expect(page.locator(".nf-tile").first()).toHaveCSS("left", /^28\./);
    await expect(page.locator(".nf-stage")).toHaveCSS("height", "560px");
    await expect(page.locator(".nf-title")).toHaveCSS("font-size", "30px");

    const layout = await page.evaluate(() => {
      const [primary, secondary] = [...globalThis.document.querySelectorAll(".nf-button")].map(
        (element) => element.getBoundingClientRect(),
      );
      const title = globalThis.document.querySelector(".nf-title")?.getBoundingClientRect();
      return {
        sideBySide: primary?.top === secondary?.top,
        titleHeight: title?.height,
      };
    });
    expect(layout.sideBySide).toBe(true);
    expect(layout.titleHeight).toBeLessThan(40);
    await expect(page.locator(".nf-tile").first()).toHaveCSS("z-index", "0");
    for (const selector of [".nf-code", ".nf-title", ".nf-message", ".nf-actions"])
      await expect(page.locator(selector)).toHaveCSS("z-index", "2");
    const covered = await page.evaluate(() => {
      const pageDocument = globalThis.document;
      return [
        ...pageDocument.querySelectorAll("h1"),
        ...pageDocument.querySelectorAll("p"),
        ...pageDocument.querySelectorAll(".nf-button"),
        ...pageDocument
          .querySelectorAll(".nf-code")
          .values()
          .flatMap((code) => code.querySelectorAll(":scope > span")),
      ]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const top = pageDocument.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return element.contains(top);
        })
        .every(Boolean);
    });
    expect(covered).toBe(true);
  });
}

test("with motion allowed the scroll timeline drives the tiles and fades the title", async ({
  page,
}) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto("/");
  await page.locator(".stack-scene").evaluate((element) => {
    const { top, height } = element.getBoundingClientRect();
    window.scrollTo(0, top + window.scrollY + height * 0.3);
  });
  await expect(page.locator(".stack-tile-scatter").first()).toHaveCSS(
    "animation-timeline",
    "--stack, --stack",
  );
  await expect
    .poll(() =>
      page.locator(".stack-title").evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeLessThan(1);
});

const SHORT_VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
] as const;

for (const viewport of SHORT_VIEWPORTS) {
  test(`${String(viewport.width)}x${String(viewport.height)} keeps the headline in the first viewport and the hero chips clear of the Dock`, async ({
    page,
  }) => {
    await preparePage(page, "light");
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settlePage(page);
    const layout = await page.evaluate(() => {
      const pageDocument = globalThis.document;
      const rectOf = (selector: string) =>
        pageDocument.querySelector(selector)?.getBoundingClientRect();
      const dock = rectOf("[data-dock-nav]");
      const chips = [".floaty-clock", "[data-availability]"]
        .map((selector) => rectOf(selector))
        .filter((rect) => rect !== undefined);
      return {
        headlineTop: rectOf("h1")?.top ?? Infinity,
        dockOverlaps: chips.map(
          (chip) =>
            dock !== undefined &&
            chip.left < dock.right &&
            chip.right > dock.left &&
            chip.top < dock.bottom &&
            chip.bottom > dock.top,
        ),
        chipCount: chips.length,
      };
    });
    expect(layout.headlineTop).toBeLessThan(viewport.height);
    expect(layout.chipCount).toBe(2);
    expect(layout.dockOverlaps).toEqual([false, false]);
  });
}

const STACK_PHONE_WIDTHS = [320, 360, 390, 430, 768] as const;
const STACK_SAMPLES = 24;

for (const width of STACK_PHONE_WIDTHS) {
  test(`${String(width)}px Stack tiles never cross the heading and the pin stays short`, async ({
    page,
  }) => {
    const height = width === 768 ? 1024 : 800;
    await preparePage(page, "light", "no-preference");
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await settlePage(page);
    await expect(page.locator(".stack-tile-scatter").first()).toHaveCSS(
      "animation-timeline",
      "--stack, --stack",
    );
    const geometry = await page.locator(".stack-scene").evaluate((element) => {
      const { top, height: sceneHeight } = element.getBoundingClientRect();
      const stage = element.querySelector(".stack-stage");
      return {
        sceneTop: top + globalThis.scrollY,
        pinned: sceneHeight - (stage?.getBoundingClientRect().height ?? 0),
      };
    });
    expect(geometry.pinned).toBeLessThanOrEqual(height * 0.7);

    const start = geometry.sceneTop - height;
    const end = geometry.sceneTop + geometry.pinned;
    const crossings: string[] = [];
    for (let step = 0; step <= STACK_SAMPLES; step += 1) {
      const offset = Math.round(start + ((end - start) * step) / STACK_SAMPLES);
      await page.evaluate(async (scrollTop) => {
        globalThis.scrollTo(0, scrollTop);
        await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
        await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
      }, offset);
      const found = await page.evaluate(() => {
        const pageDocument = globalThis.document;
        const title = pageDocument.querySelector(".stack-title")?.getBoundingClientRect();
        return title
          ? [...pageDocument.querySelectorAll(".stack-tile-scatter")]
              .map((tile) => tile.getBoundingClientRect())
              .filter(
                (box) =>
                  box.width > 0 &&
                  box.left < title.right &&
                  box.right > title.left &&
                  box.top < title.bottom &&
                  box.bottom > title.top,
              )
              .map((box) => `${String(Math.round(box.left))},${String(Math.round(box.top))}`)
          : ["no title"];
      });
      if (found.length > 0) crossings.push(`${String(offset)}: ${found.join(" ")}`);
    }
    expect(crossings).toEqual([]);
  });
}
