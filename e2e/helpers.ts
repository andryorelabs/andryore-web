import { expect, type Page } from "@playwright/test";

import { UMAMI_SCRIPT_URL } from "../src/lib/analytics";
import type { Theme } from "./routes";

const THEME_STORAGE_KEY = "theme";

/**
 * The instant every page sees as now: a Wednesday, so the stream tile's
 * countdown and today marker render the same on any day.
 */
const FROZEN_NOW = new Date("2026-01-14T12:00:00Z");

/**
 * Pins the theme before any page script runs, sets the motion preference
 * (reduced by default), freezes `Date` (timers keep running) at {@link FROZEN_NOW} and
 * answers the runtime endpoints that only the production server serves. The
 * contributions answer is not a valid snapshot, so the tile keeps its build
 * data without a network error. The Umami script is answered locally so a
 * run never depends on the third-party host being reachable.
 * @param page The page to configure.
 * @param theme The theme to paint.
 * @param reducedMotion The motion preference to emulate.
 */
export async function preparePage(
  page: Page,
  theme: Theme,
  reducedMotion: "reduce" | "no-preference" = "reduce",
): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion });
  await page.route("**/api/stream-status", (route) =>
    route.fulfill({ json: { state: "offline" } }),
  );
  await page.route("**/api/github-contributions", (route) => route.fulfill({ json: {} }));
  await page.route(UMAMI_SCRIPT_URL, (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.addInitScript(
    ([key, value]) => {
      globalThis.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
  await page.addInitScript((frozenMilliseconds) => {
    const FrozenDate = new Proxy(Date, {
      construct(target, constructorArguments) {
        const forwarded: unknown[] = constructorArguments;
        return forwarded.length === 0
          ? new target(frozenMilliseconds)
          : new target(...(forwarded as [number]));
      },
      get(target, property) {
        if (property === "now") return () => frozenMilliseconds;
        const value: unknown = Reflect.get(target, property);
        return value;
      },
    });
    Object.defineProperty(globalThis, "Date", { value: FrozenDate });
  }, FROZEN_NOW.getTime());
}

/**
 * Brings the page to a stable state: islands hydrated, lazy images loaded,
 * fonts and network settled, no CSS transition left running.
 * @param page The page to settle.
 */
export async function settlePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(globalThis.innerHeight, 1);
    for (let top = 0; top < globalThis.document.documentElement.scrollHeight; top += step) {
      globalThis.scrollTo(0, top);
      await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
    }
    globalThis.scrollTo(0, 0);
    for (const island of globalThis.document.querySelectorAll("astro-island[ssr]")) {
      island.dispatchEvent(new globalThis.FocusEvent("focusin"));
    }
    for (const image of globalThis.document.querySelectorAll('img[loading="lazy"]')) {
      image.setAttribute("loading", "eager");
    }
  });
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    for (const image of globalThis.document.images) {
      try {
        await image.decode();
      } catch {
        continue;
      }
    }
  });
  const reducesMotion = await page.evaluate(
    () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  if (reducesMotion) {
    await expect
      .poll(() => page.evaluate(() => globalThis.document.getAnimations().length))
      .toBe(0);
  }
}

/**
 * Lists every sign of horizontal overflow: a document wider than the viewport
 * and any element, fixed ones included, whose right edge passes the viewport.
 * An element clipped on purpose by an ancestor with `overflow: hidden` or
 * `clip` that sits inside the viewport is ignored.
 * @param page The page to measure.
 * @returns A description of each overflow found.
 */
export async function findHorizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = globalThis.document.documentElement;
    const width = root.clientWidth;
    const found: string[] = [];
    if (root.scrollWidth > width) {
      found.push(`document scrollWidth ${String(root.scrollWidth)} > clientWidth ${String(width)}`);
    }
    const isClipped = (element: Element): boolean => {
      for (
        let ancestor = element.parentElement;
        ancestor && ancestor !== globalThis.document.body;
        ancestor = ancestor.parentElement
      ) {
        const style = globalThis.getComputedStyle(ancestor);
        if (style.position === "fixed") return false;
        const isClips = ["hidden", "clip"].includes(style.overflowX);
        if (!isClips) continue;
        const bounds = ancestor.getBoundingClientRect();
        if (bounds.left >= -0.5 && bounds.right <= width + 0.5) return true;
      }
      return false;
    };
    for (const element of globalThis.document.body.querySelectorAll("*")) {
      const bounds = element.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0 || bounds.right <= width + 0.5) continue;
      const style = globalThis.getComputedStyle(element);
      if (
        style.visibility === "hidden" ||
        style.display === "contents" ||
        element.closest(".sr-only, [hidden]") ||
        isClipped(element)
      )
        continue;
      const label = `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
      found.push(`${label} right ${String(Math.round(bounds.right))} > ${String(width)}`);
    }
    return found.slice(0, 20);
  });
}

/**
 * Asserts the page has no horizontal overflow, hidden or visible.
 * @param page The page to measure.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await findHorizontalOverflow(page)).toEqual([]);
}

const TOUCH_TARGET_LIMITS = {
  standard: 43.5,
  compactDock: 24,
  compactBelow: 400,
};

/**
 * Lists the standalone controls smaller than the touch target minimum. Links
 * inside running text are exempt, as in WCAG 2.5.8.
 * @param page The page to measure.
 * @returns A description of each control that is too small.
 */
export async function findSmallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate((limits) => {
    const small: string[] = [];
    const isCompact = globalThis.document.documentElement.clientWidth < limits.compactBelow;
    const controls = globalThis.document.querySelectorAll<HTMLElement>(
      'a[href], button, [role="button"], summary',
    );
    for (const control of controls) {
      const inline = control.closest("p, li, dd, blockquote");
      const bounds = control.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) continue;
      if (inline && !control.closest("nav, footer")) continue;
      if (control.closest('.sr-only, [hidden], [aria-hidden="true"]')) continue;
      const minimum =
        isCompact && control.closest("[data-dock-nav]") ? limits.compactDock : limits.standard;
      if (bounds.width < minimum || bounds.height < minimum) {
        small.push(
          `${control.tagName.toLowerCase()} "${control.textContent.trim().slice(0, 30)}" ${String(Math.round(bounds.width))}x${String(Math.round(bounds.height))}`,
        );
      }
    }
    return small;
  }, TOUCH_TARGET_LIMITS);
}

/**
 * Lists the Dock boxes that stick out of the viewport: every control, every
 * tooltip, and the menu panel when one is open. The Dock is fixed, so the
 * document scroll width never sees it.
 * @param page The page to measure.
 * @returns A description of each box that is not fully inside the viewport.
 */
export async function findDockOutsideViewport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = globalThis.document.documentElement.clientWidth;
    const outside: string[] = [];
    const boxes = globalThis.document.querySelectorAll<HTMLElement>(
      '[data-dock-nav] a, [data-dock-nav] button, [data-dock-nav] .group > span[aria-hidden="true"], [data-dock-panel]',
    );
    for (const box of boxes) {
      const bounds = box.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) continue;
      if (bounds.left >= 0 && bounds.right <= width) continue;
      const name = (box.getAttribute("aria-label") ?? box.textContent).trim();
      outside.push(
        `${box.tagName.toLowerCase()} "${name.slice(0, 30)}" ${String(Math.round(bounds.left))}..${String(Math.round(bounds.right))} of ${String(width)}`,
      );
    }
    return outside;
  });
}

/**
 * Lists the elements whose text is cut off by their own box.
 * @param page The page to measure.
 * @returns A description of each element that clips its content.
 */
export async function findClippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const clipped: string[] = [];
    const candidates = globalThis.document.querySelectorAll<HTMLElement>(
      "h1, h2, h3, p, a, button, li, span, dt, dd",
    );
    for (const element of candidates) {
      const style = globalThis.getComputedStyle(element);
      const isHides = style.overflowX === "hidden" || style.overflowX === "clip";
      const isVisuallyHidden = element.clientWidth <= 1;
      if (isHides && !isVisuallyHidden && element.scrollWidth > element.clientWidth + 1) {
        clipped.push(
          `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 30)}"`,
        );
      }
    }
    return clipped;
  });
}

/**
 * Finds Uses hero icons that overlap the title or intro, or stick out of the
 * hero card.
 * @param page The Uses page, already settled.
 * @returns A description of each icon that overlaps text or is clipped.
 */
export async function findUsesHeroIconProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const pageDocument = globalThis.document;
    const card = pageDocument.querySelector('section[aria-labelledby="uses-heading"]');
    const heading = pageDocument.querySelector("#uses-heading");
    const intro = heading?.nextElementSibling;
    if (!card || !heading || !intro) return ["uses hero is missing"];
    const cardBox = card.getBoundingClientRect();
    const textBoxes = [heading, intro].map((node) => node.getBoundingClientRect());
    const problems: string[] = [];
    const icons = card.querySelectorAll(":scope [data-uses-field] > span");
    for (const [index, icon] of [...icons].entries()) {
      const box = icon.getBoundingClientRect();
      const hitsText = textBoxes.some(
        (text) =>
          box.left < text.right &&
          box.right > text.left &&
          box.top < text.bottom &&
          box.bottom > text.top,
      );
      if (hitsText) problems.push(`icon ${String(index)} overlaps the text`);
      const isClipped =
        box.left < cardBox.left ||
        box.right > cardBox.right ||
        box.top < cardBox.top ||
        box.bottom > cardBox.bottom;
      if (isClipped) problems.push(`icon ${String(index)} is clipped by the card`);
    }
    if (icons.length === 0) problems.push("no icons found");
    return problems;
  });
}

/**
 * Finds a product hero image that is cropped instead of showing the full
 * frame.
 * @param page A product page, already settled.
 * @returns A description of the hero image when its box does not match the
 * image's own aspect ratio.
 */
export async function findCroppedHeroImage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const image = globalThis.document.querySelector<HTMLImageElement>(
      "[data-product-hero] picture img",
    );
    if (!image) return ["hero image is missing"];
    const box = image.getBoundingClientRect();
    const natural = image.naturalWidth / image.naturalHeight;
    const shown = box.width / box.height;
    return Math.abs(natural - shown) / natural > 0.02
      ? [`hero shows ${shown.toFixed(2)} for a ${natural.toFixed(2)} image`]
      : [];
  });
}
