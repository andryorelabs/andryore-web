import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { findHorizontalOverflow } from "../e2e/helpers";
import { PHONE_WIDTHS } from "../e2e/routes";
import { ALLOWED_ORIGINS } from "./audit-distribution";
import {
  countDeviations,
  describeOverflow,
  DOCUMENTED_EXCEPTIONS,
  failedMeasurements,
  findMissingTexts,
  formatReport,
  isDocumentedMeasurement,
  isMissingSoundAsset,
  resolveCanvasPath,
  type MeasurementResult,
  type ReportSection,
} from "./fidelity-audit-core";

type Language = "en" | "es";
type Theme = "light" | "dark";
type Viewport = 1440 | 390;
type Metric =
  | "fontSize"
  | "width"
  | "height"
  | "minHeight"
  | "paddingLeft"
  | "columnGap"
  | "radius"
  | "viewportBottom"
  | "scale";

interface TextQuery {
  readonly scope: string;
  readonly exclude: string;
}

interface MeasureQuery {
  readonly scope: string;
  readonly selector: string;
  readonly metric: Metric;
  readonly divideByScale: boolean;
}

interface Scene {
  readonly name: string;
  readonly board: string;
  readonly route: string;
  readonly canvasScope?: string;
  readonly product?: string;
}

interface Measurement {
  readonly id: string;
  readonly scene: string;
  readonly route: string;
  readonly viewports: readonly Viewport[];
  readonly canvas?: { readonly board: string; readonly selector: string };
  readonly prodSelector: string;
  readonly metric: Metric;
  readonly handoff: Partial<Record<Viewport, number>>;
}

const KEYS_TO_STOP = ["ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft"] as const;
const coverage = { texts: 0, pages: 0, measurements: 0 };
const CANVAS_VIEWPORT_WIDTH = 1600;
const PREVIEW_PORT = 4418;
const OUTPUT_DIRECTORY = "audit-output";
const TOLERANCE = 0.75;
const NOT_FOUND_ROUTE = "/404/";
const LANGUAGES: readonly Language[] = ["en", "es"];
const THEMES: readonly Theme[] = ["light", "dark"];
const VIEWPORTS: readonly Viewport[] = [1440, 390];
const CANVAS_EXCLUDED = ".cue, .scrub, .keyframes, .smp, [data-scrub], .ab-head, .handoff";
const STREAM_STATES = [
  { canvas: "soon", label: "Coming soon", started: false, status: "offline" },
  { canvas: "offline", label: "Scheduled", started: true, status: "offline" },
  { canvas: "live", label: "Live", started: false, status: "live" },
  {
    canvas: "unavailable",
    label: "Unavailable",
    started: false,
    status: "unavailable",
  },
] as const;

const SCENES: readonly Scene[] = [
  { name: "Chrome", board: "chrome", route: "/" },
  { name: "Home", board: "home", route: "/" },
  {
    name: "Stack scene",
    board: "stackscene",
    route: "/",
    canvasScope: ".scene",
  },
  {
    name: "Product Snug",
    board: "product",
    route: "/products/snug/",
    product: "0",
  },
  {
    name: "Product Animated Fluent Emojis",
    board: "product",
    route: "/products/animated-fluent-emojis/",
    product: "1",
  },
  {
    name: "Product JSON Flow",
    board: "product",
    route: "/products/json-flow/",
    product: "2",
  },
  { name: "About", board: "about", route: "/about/" },
  { name: "Uses", board: "uses", route: "/uses/" },
  { name: "404", board: "notfound", route: NOT_FOUND_ROUTE },
];

const PAGE_ROUTES: readonly string[] = [...new Set(SCENES.map((scene) => scene.route))];

/**
 * Documented exceptions and canvas-only strings: the Privacy card is out of
 * scope, "Disponible" is a placeholder, live data (clock, counts, stream
 * title, best day, capture date) differs per run, the canvas shows review
 * notes and annotations that are not Site copy, hardcodes English in the
 * Spanish pass for the top bar pill and the nav label, labels its Ao mark
 * for review only, and renders the CV menu items that the Site only mounts
 * when the menu opens (checked in the interaction pass).
 */
const IGNORED_TEXT: readonly RegExp[] = [
  /^(Disponible|Available)$/,
  /^Privacy\b|^Privacidad\b/,
  /\b\d{1,2}:\d{2}\b/,
  /\bUpdated \d+ min ago\b|\bActualizado hace \d+ min\b/,
  /^\d+([.,]\d{3})*\+?$/,
  /^(Sample|Muestra)$/,
  /^(Best day|Mejor día) · /,
  /^(Captured|Capturado) \d{4}-\d{2}-\d{2}$/,
  /co-working session, bring your work|sesión de co-working, trae tu trabajo/i,
  /^(Drafted from|Borrador desde) /,
  /^viewport fold \d+ px$/,
  /^(Dock, |Language menu open|Theme menu open|Menú de idioma abierto|Menú de tema abierto|Focus ring and skip link|Foco visible y enlace de salto)/,
  /^(Open to work|Main|Ao)$/,
  /^(CV · EN|Spanish \(PDF\)|Inglés \(PDF\))$/,
];

const MEASUREMENTS: readonly Measurement[] = [
  {
    id: "wordmark font size",
    scene: "Chrome",
    route: "/",
    viewports: [1440, 390],
    canvas: { board: "chrome", selector: ".s-word" },
    prodSelector: ".site-header a",
    metric: "fontSize",
    handoff: { 1440: 20, 390: 20 },
  },
  {
    id: "dock padding",
    scene: "Chrome",
    route: "/",
    viewports: [1440],
    canvas: { board: "chrome", selector: ".dock" },
    prodSelector: "[data-dock-nav]",
    metric: "paddingLeft",
    handoff: { 1440: 8 },
  },
  {
    id: "dock gap",
    scene: "Chrome",
    route: "/",
    viewports: [1440],
    canvas: { board: "chrome", selector: ".dock" },
    prodSelector: "[data-dock-nav]",
    metric: "columnGap",
    handoff: { 1440: 4 },
  },
  {
    id: "dock button width",
    scene: "Chrome",
    route: "/",
    viewports: [1440, 390],
    canvas: { board: "chrome", selector: ".dock .dk" },
    prodSelector: "[data-dock-nav] a",
    metric: "width",
    handoff: { 1440: 44, 390: 44 },
  },
  {
    id: "dock distance from the viewport bottom",
    scene: "Chrome",
    route: "/",
    viewports: [1440, 390],
    prodSelector: "[data-dock-nav]",
    metric: "viewportBottom",
    handoff: { 1440: 16, 390: 16 },
  },
  {
    id: "Find me button width",
    scene: "Home",
    route: "/",
    viewports: [1440, 390],
    canvas: { board: "home", selector: ".soc a" },
    prodSelector: ".find-me-link",
    metric: "width",
    handoff: { 1440: 60, 390: 52 },
  },
  {
    id: "Find me logo width",
    scene: "Home",
    route: "/",
    viewports: [1440],
    canvas: { board: "home", selector: ".soc a .ic" },
    prodSelector: ".find-me-link :is(svg, img)",
    metric: "width",
    handoff: { 1440: 28 },
  },
  {
    id: "end card tile width",
    scene: "Stack scene",
    route: "/",
    viewports: [1440],
    canvas: { board: "stackscene", selector: ".scene .fin .stk-row span" },
    prodSelector: ".stack-end-tiles > *",
    metric: "width",
    handoff: { 1440: 54 },
  },
  {
    id: "end card tile gap",
    scene: "Stack scene",
    route: "/",
    viewports: [1440],
    canvas: { board: "stackscene", selector: ".scene .fin .stk-row" },
    prodSelector: ".stack-end-tiles",
    metric: "columnGap",
    handoff: { 1440: 12 },
  },
  {
    id: "product column width",
    scene: "Product Snug",
    route: "/products/snug/",
    viewports: [1440],
    canvas: { board: "product", selector: ".s-main.narrow > section" },
    prodSelector: "main > article",
    metric: "width",
    handoff: { 1440: 712 },
  },
  {
    id: "Uses badge height",
    scene: "Uses",
    route: "/uses/",
    viewports: [1440],
    canvas: { board: "uses", selector: ".bdg" },
    prodSelector: "#tools a",
    metric: "height",
    handoff: { 1440: 34 },
  },
  {
    id: "Uses badge radius",
    scene: "Uses",
    route: "/uses/",
    viewports: [1440],
    canvas: { board: "uses", selector: ".bdg" },
    prodSelector: "#tools a",
    metric: "radius",
    handoff: { 1440: 6 },
  },
  {
    id: "Uses field height",
    scene: "Uses",
    route: "/uses/",
    viewports: [1440, 390],
    canvas: { board: "uses", selector: ".field" },
    prodSelector: ".isolate.relative.overflow-hidden",
    metric: "height",
    handoff: { 1440: 420, 390: 360 },
  },
  {
    id: "404 digit font size",
    scene: "404",
    route: NOT_FOUND_ROUTE,
    viewports: [1440, 390],
    canvas: { board: "notfound", selector: ".nf .four" },
    prodSelector: ".nf-code",
    metric: "fontSize",
    handoff: { 1440: 190, 390: 110 },
  },
  {
    id: "404 emoji width",
    scene: "404",
    route: NOT_FOUND_ROUTE,
    viewports: [1440, 390],
    canvas: { board: "notfound", selector: ".nf .zero" },
    prodSelector: ".nf-monocle",
    metric: "width",
    handoff: { 1440: 170, 390: 100 },
  },
  {
    id: "404 panel height",
    scene: "404",
    route: NOT_FOUND_ROUTE,
    viewports: [1440, 390],
    canvas: { board: "notfound", selector: ".nf" },
    prodSelector: ".nf-stage",
    metric: "height",
    handoff: { 1440: 640, 390: 560 },
  },
  {
    id: "404 panel radius",
    scene: "404",
    route: NOT_FOUND_ROUTE,
    viewports: [1440, 390],
    canvas: { board: "notfound", selector: ".nf" },
    prodSelector: ".nf-stage",
    metric: "radius",
    handoff: { 1440: 28, 390: 28 },
  },
  {
    id: "About memoji width",
    scene: "About",
    route: "/about/",
    viewports: [1440],
    canvas: { board: "about", selector: ".ab-hero img" },
    prodSelector: 'main img[src*="memoji"]',
    metric: "width",
    handoff: { 1440: 120 },
  },
];

/**
 * Reads the leaf strings of an element: text nodes plus accessible names.
 * Runs in the page.
 * @param query The scope selector and the selector to leave out.
 * @returns The strings found.
 */
function collectTexts(query: TextQuery): string[] {
  const root = globalThis.document.querySelector(query.scope);
  if (!root) return [];
  const found: string[] = [];
  const shouldSkip = (element: Element | null): boolean =>
    element !== null &&
    (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName) ||
      (query.exclude !== "" && element.closest(query.exclude) !== null));
  const walker = globalThis.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? "";
    if (text !== "" && !shouldSkip(node.parentElement)) found.push(text);
  }
  for (const element of root.querySelectorAll("[aria-label],[alt]")) {
    if (shouldSkip(element)) continue;
    for (const name of ["aria-label", "alt"]) {
      const value = element.getAttribute(name)?.trim();
      if (value) found.push(value);
    }
  }
  return found;
}

/**
 * Reads one metric of the first matching element that has a box. Runs in
 * the page.
 * @param query The scope, selector, metric and canvas scale factor.
 * @returns The value in pixels (or a scale factor), or undefined.
 */
function measure(query: MeasureQuery): number | undefined {
  const root = globalThis.document.querySelector(query.scope);
  const candidates = root ? [...root.querySelectorAll(query.selector)] : [];
  const element =
    candidates.find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return box.width > 0 || box.height > 0;
    }) ?? candidates[0];
  if (!element) return undefined;
  const style = getComputedStyle(element);
  const frame = element.closest(".frame");
  const scale = query.divideByScale
    ? Number(frame instanceof HTMLElement ? frame.dataset.scale : 1) || 1
    : 1;
  const box = element.getBoundingClientRect();
  const pixels = (value: string): number => Number(value.replace("px", ""));
  switch (query.metric) {
    case "fontSize": {
      return pixels(style.fontSize);
    }
    case "width": {
      return element instanceof HTMLElement ? element.offsetWidth : box.width / scale;
    }
    case "height": {
      return element instanceof HTMLElement ? element.offsetHeight : box.height / scale;
    }
    case "minHeight": {
      return pixels(style.minHeight);
    }
    case "paddingLeft": {
      return pixels(style.paddingLeft);
    }
    case "columnGap": {
      return pixels(style.columnGap);
    }
    case "radius": {
      return pixels(style.borderTopLeftRadius);
    }
    case "viewportBottom": {
      return globalThis.innerHeight - box.bottom;
    }
    case "scale": {
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      return matrix.a;
    }
  }
}

/**
 * Starts `astro preview` unless a base URL was given.
 * @returns The base URL and a stop function.
 */
async function startPreview(): Promise<{
  baseUrl: string;
  stop: () => unknown;
}> {
  const given = process.env.AUDIT_BASE_URL;
  if (given) return { baseUrl: given, stop: () => false };
  const child = Bun.spawn(
    [
      "bun",
      "run",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(PREVIEW_PORT),
      "--ignore-lock",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  const baseUrl = `http://127.0.0.1:${String(PREVIEW_PORT)}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok)
        return {
          baseUrl,
          stop: () => {
            child.kill();
          },
        };
    } catch {
      await Bun.sleep(500);
    }
  }
  child.kill();
  throw new Error(`The preview did not start on ${baseUrl}.`);
}

interface SiteOptions {
  readonly route: string;
  readonly language: Language;
  readonly theme: Theme;
  readonly streamStatus?: string;
  readonly streamStarted?: boolean;
}

interface SiteProbe {
  readonly consoleErrors: string[];
  readonly foreignRequests: string[];
}

/**
 * Opens a prod page with the network pinned to the local preview.
 * @param context Context that carries the color scheme and viewport.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @param options Route, locale, theme and the forced stream state.
 * @returns The page and what it reported while loading.
 */
async function openSite(
  context: BrowserContext,
  baseUrl: string,
  options: SiteOptions,
): Promise<{ page: Page; probe: SiteProbe }> {
  coverage.pages += 1;
  const page = await context.newPage();
  const probe: SiteProbe = { consoleErrors: [], foreignRequests: [] };
  const origin = new URL(baseUrl).origin;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const url = message.location().url;
    if (url !== "" && isMissingSoundAsset(text, url)) return;
    probe.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => {
    probe.consoleErrors.push(error.message);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === "data:") {
      return route.fallback();
    }
    if (!ALLOWED_ORIGINS.includes(url.origin)) {
      probe.foreignRequests.push(url.href);
    }
    return route.fulfill({ status: 200, body: "", contentType: "text/plain" });
  });
  await page.route("**/api/stream-status", (route) =>
    route.fulfill({
      json:
        options.streamStatus === "live"
          ? { state: "live", title: "Building the site" }
          : { state: options.streamStatus ?? "offline" },
    }),
  );
  await page.route("**/api/github-contributions", (route) => route.fulfill({ json: {} }));
  if (options.streamStarted) {
    await page.route(`${origin}/${options.language === "es" ? "es/" : ""}`, async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      const body = html.replaceAll('data-started="false"', 'data-started="true"');
      await route.fulfill({ response, body });
    });
  }
  await page.addInitScript((theme) => {
    globalThis.localStorage.setItem("theme", theme);
  }, options.theme);
  const prefix = options.language === "es" ? "/es" : "";
  await page.goto(`${baseUrl}${prefix}${options.route}`);
  await settle(page);
  return { page, probe };
}

/**
 * Scrolls the page to trigger lazy content and waits for it to settle.
 * @param page Page whose lazy content should load.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(globalThis.innerHeight, 1);
    const total = globalThis.document.documentElement.scrollHeight;
    for (let top = 0; top < total; top += step) {
      globalThis.scrollTo(0, top);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 60));
    }
    globalThis.scrollTo(0, 0);
    await globalThis.document.fonts.ready;
  });
  await page.waitForLoadState("networkidle");
}

/**
 * Opens the local canvas with the network blocked and its chrome neutralized.
 * @param browser Chromium instance that opens every page of the pass.
 * @param canvasPath Path of the saved canvas HTML, opened through file://.
 * @returns The canvas page.
 */
async function openCanvas(browser: Browser, canvasPath: string): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: CANVAS_VIEWPORT_WIDTH, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route(/^https?:/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`file://${path.resolve(canvasPath)}`);
  await page.addStyleTag({
    content:
      ".rv,.reveal{opacity:1!important;transform:none!important;animation:none!important}.bar{position:static!important}",
  });
  return page;
}

/**
 * Presses one canvas control button and waits for the boards to rebuild.
 * @param page Page showing the local canvas.
 * @param selector CSS selector of the canvas button to click.
 */
async function press(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().click();
  await page.waitForTimeout(150);
}

/**
 * Sets the canvas language, theme and viewport.
 * @param page Page showing the local canvas.
 * @param language Locale to switch the canvas to.
 * @param theme Color scheme to switch the canvas to.
 * @param viewport Canvas viewport button to press, 1440 or 390.
 */
async function configureCanvas(
  page: Page,
  language: Language,
  theme: Theme,
  viewport: Viewport,
): Promise<void> {
  await press(page, `.bar [data-ctl="lang"] [data-v="${language}"]`);
  await press(page, `.bar [data-ctl="theme"] [data-v="${theme}"]`);
  await press(page, `.bar [data-ctl="vp"] [data-v="${String(viewport)}"]`);
}

/**
 * Forces every deferred block of the canvas visible.
 * @param page Page showing the local canvas.
 */
async function revealCanvas(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const element of globalThis.document.querySelectorAll(".rv,.reveal")) {
      element.classList.add("in", "on", "vis", "visible");
    }
  });
  await page.waitForTimeout(100);
}

/**
 * Compares the canvas text of every scene with the rendered Site.
 * @param browser Chromium instance that opens every page of the pass.
 * @param canvasPath Path of the saved canvas HTML, opened through file://.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @returns The report lines and the console and request findings.
 */
async function auditTexts(
  browser: Browser,
  canvasPath: string,
  baseUrl: string,
): Promise<{ text: string[]; console: string[]; network: string[] }> {
  const text: string[] = [];
  const consoleLines: string[] = [];
  const network: string[] = [];
  for (const viewport of VIEWPORTS) {
    const canvas = await openCanvas(browser, canvasPath);
    for (const language of LANGUAGES) {
      for (const theme of THEMES) {
        await configureCanvas(canvas, language, theme, viewport);
        const context = await browser.newContext({
          viewport: { width: viewport, height: 900 },
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        for (const scene of SCENES) {
          const label = `${scene.name} ${language} ${theme} ${String(viewport)}`;
          if (scene.product) {
            await press(canvas, `#product [data-state="prodSel"] [data-v="${scene.product}"]`);
          }
          await revealCanvas(canvas);
          const scope = `#${scene.board} .frame ${scene.canvasScope ?? ""}`.trim();
          const canvasTexts = await canvas.evaluate(collectTexts, {
            scope,
            exclude: CANVAS_EXCLUDED,
          });
          coverage.texts += canvasTexts.length;
          const { page, probe } = await openSite(context, baseUrl, {
            route: scene.route,
            language,
            theme,
          });
          const rendered = await page.evaluate(collectTexts, {
            scope: "body",
            exclude: "",
          });
          text.push(
            ...findMissingTexts(label, canvasTexts, rendered, IGNORED_TEXT).map(
              (item) => `${item.scene}: "${item.text}"`,
            ),
          );
          consoleLines.push(...probe.consoleErrors.map((error) => `${label}: ${error}`));
          network.push(...probe.foreignRequests.map((url) => `${label}: ${url}`));
          await page.close();
        }
        await context.close();
      }
    }
    await canvas.context().close();
  }
  return { text, console: consoleLines, network };
}

/**
 * Compares the Stream and GitHub tiles state by state.
 * @param browser Chromium instance that opens every page of the pass.
 * @param canvasPath Path of the saved canvas HTML, opened through file://.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @returns The report lines.
 */
async function auditStates(
  browser: Browser,
  canvasPath: string,
  baseUrl: string,
): Promise<string[]> {
  const lines: string[] = [];
  const canvas = await openCanvas(browser, canvasPath);
  for (const language of LANGUAGES) {
    await configureCanvas(canvas, language, "dark", 1440);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    for (const state of STREAM_STATES) {
      await press(canvas, `#home [data-state="stream"] [data-v="${state.canvas}"]`);
      await revealCanvas(canvas);
      const canvasTexts = await canvas.evaluate(collectTexts, {
        scope: "#home .frame .t-stream",
        exclude: CANVAS_EXCLUDED,
      });
      const { page } = await openSite(context, baseUrl, {
        route: "/",
        language,
        theme: "dark",
        streamStatus: state.status,
        streamStarted: state.started,
      });
      await page.waitForTimeout(400);
      const rendered = await page.evaluate(collectTexts, {
        scope: "[data-stream-tile]",
        exclude: "",
      });
      lines.push(
        ...findMissingTexts(
          `Stream ${state.label} ${language}`,
          canvasTexts,
          rendered,
          IGNORED_TEXT,
        ).map((item) => `${item.scene}: "${item.text}"`),
      );
      await page.close();
    }
    for (const source of ["live", "cap"]) {
      await press(canvas, `#home [data-state="gh"] [data-v="${source}"]`);
      await revealCanvas(canvas);
      const canvasTexts = await canvas.evaluate(collectTexts, {
        scope: "#home .frame .t-git",
        exclude: CANVAS_EXCLUDED,
      });
      const { page } = await openSite(context, baseUrl, {
        route: "/",
        language,
        theme: "dark",
      });
      const rendered = await page.evaluate(collectTexts, {
        scope: "[data-github-grid]",
        exclude: "",
      });
      lines.push(
        ...findMissingTexts(
          `GitHub ${source === "live" ? "Live" : "Build capture"} ${language}`,
          canvasTexts,
          rendered,
          IGNORED_TEXT,
        ).map((item) => `${item.scene}: "${item.text}"`),
      );
      await page.close();
    }
    await context.close();
  }
  await canvas.context().close();
  return lines;
}

/**
 * Measures the hand-off values on the canvas and the Site.
 * @param browser Chromium instance that opens every page of the pass.
 * @param canvasPath Path of the saved canvas HTML, opened through file://.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @returns The report lines.
 */
async function auditMeasurements(
  browser: Browser,
  canvasPath: string,
  baseUrl: string,
): Promise<string[]> {
  const results: MeasurementResult[] = [];
  const notes = new Map<string, string>();
  for (const viewport of VIEWPORTS) {
    const canvas = await openCanvas(browser, canvasPath);
    await configureCanvas(canvas, "en", "dark", viewport);
    await revealCanvas(canvas);
    const context = await browser.newContext({
      viewport: { width: viewport, height: 900 },
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    for (const item of MEASUREMENTS) {
      if (!item.viewports.includes(viewport)) continue;
      const handoff = item.handoff[viewport];
      if (handoff === undefined) continue;
      const canvasValue = item.canvas
        ? await canvas.evaluate(measure, {
            scope: `#${item.canvas.board} .frame`,
            selector: item.canvas.selector,
            metric: item.metric,
            divideByScale: true,
          })
        : undefined;
      const { page } = await openSite(context, baseUrl, {
        route: item.route,
        language: "en",
        theme: "dark",
      });
      const actual = await page.evaluate(measure, {
        scope: "body",
        selector: item.prodSelector,
        metric: item.metric,
        divideByScale: false,
      });
      await page.close();
      const id = `${item.id} @${String(viewport)}`;
      coverage.measurements += 1;
      results.push({
        id,
        scene: item.scene,
        expected: canvasValue ?? handoff,
        actual,
      });
      notes.set(id, `canvas ${canvasValue?.toFixed(1) ?? "n/a"}, hand-off ${String(handoff)}`);
    }
    await canvas.context().close();
    await context.close();
  }
  return failedMeasurements(results, TOLERANCE)
    .filter((result) => !isDocumentedMeasurement(result.id, result.actual))
    .map(
      (result) =>
        `${result.scene}: ${result.id} is ${result.actual?.toFixed(1) ?? "missing"}, expected ${result.expected.toFixed(1)} (${notes.get(result.id) ?? ""})`,
    );
}

/**
 * Finds horizontal overflow at every phone width, at rest and scrolled, and running animations under reduced
 * motion on every route.
 * @param browser Chromium instance that opens every page of the pass.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @returns The overflow and reduced-motion lines.
 */
async function auditLayout(
  browser: Browser,
  baseUrl: string,
): Promise<{ overflow: string[]; motion: string[] }> {
  const overflow: string[] = [];
  const motion: string[] = [];
  for (const language of LANGUAGES) {
    for (const theme of THEMES) {
      for (const width of PHONE_WIDTHS) {
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          colorScheme: theme,
        });
        for (const route of PAGE_ROUTES) {
          const { page } = await openSite(context, baseUrl, {
            route,
            language,
            theme,
          });
          for (const isScrolled of [false, true]) {
            if (isScrolled) {
              await page.evaluate(() => {
                globalThis.scrollTo(0, 400);
              });
              await page.waitForTimeout(150);
            }
            const state = {
              route,
              language,
              theme,
              width,
              scrolled: isScrolled,
            };
            const findings = await findHorizontalOverflow(page);
            overflow.push(...findings.map((finding) => describeOverflow(state, finding)));
          }
          await page.close();
        }
        await context.close();
      }
    }
    const reduced = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    for (const route of PAGE_ROUTES) {
      const { page } = await openSite(reduced, baseUrl, {
        route,
        language,
        theme: "dark",
      });
      const running = await page.evaluate(() =>
        globalThis.document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getComputedTiming().iterations === Infinity,
          )
          .map((animation) =>
            animation instanceof globalThis.CSSAnimation ? animation.animationName : "script",
          ),
      );
      if (running.length > 0) {
        motion.push(
          `${route} ${language}: infinite animations still running (${[...new Set(running)].join(", ")})`,
        );
      }
      await page.close();
    }
    await reduced.close();
  }
  return { overflow, motion };
}

/**
 * Checks the Theme slider keys and the dock hover state.
 * @param browser Chromium instance that opens every page of the pass.
 * @param canvasPath Path of the saved canvas HTML, opened through file://.
 * @param baseUrl Origin of the local preview that serves the built Site.
 * @returns The report lines.
 */
async function auditInteractions(
  browser: Browser,
  canvasPath: string,
  baseUrl: string,
): Promise<string[]> {
  const lines: string[] = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const { page } = await openSite(context, baseUrl, {
    route: "/",
    language: "en",
    theme: "dark",
  });
  const canvas = await openCanvas(browser, canvasPath);
  await configureCanvas(canvas, "en", "dark", 1440);
  const slider = page.locator("[data-theme-slider]");
  await slider.scrollIntoViewIfNeeded();
  await slider.focus();
  await page.waitForTimeout(500);
  for (const key of KEYS_TO_STOP) {
    await page.locator("[data-theme-tabs] button", { hasText: "Auto" }).click();
    await slider.focus();
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    const productionStop = ((await slider.getAttribute("aria-valuetext")) ?? "").toLowerCase();
    await canvas.locator('#home [data-tab="mode:auto"]').click();
    await canvas.locator("#home [data-bright]").focus();
    await canvas.keyboard.press(key);
    await canvas.waitForTimeout(150);
    const canvasStop = await canvas
      .locator('#home [data-tabs="mode"] [aria-selected="true"]')
      .first()
      .getAttribute("data-tab");
    if (`mode:${productionStop}` !== canvasStop) {
      lines.push(
        `Theme slider ${key} from Auto lands on ${productionStop}, canvas ${canvasStop ?? "none"}`,
      );
    }
  }
  const about = await openSite(context, baseUrl, {
    route: "/about/",
    language: "en",
    theme: "dark",
  });
  await about.page.locator("[data-cv-menu-trigger]").first().click();
  const menuTexts = await about.page.evaluate(collectTexts, {
    scope: "body",
    exclude: "",
  });
  for (const label of ["Spanish (PDF)"]) {
    if (menuTexts.every((text) => !text.includes(label))) {
      lines.push(`CV menu does not list "${label}" when opened`);
    }
  }
  await about.page.close();
  await page.mouse.move(0, 0);
  const items = page.locator("[data-dock-nav] a");
  await items.nth(2).hover();
  await page.waitForTimeout(500);
  const box = await items.nth(2).boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2);
  }
  await page.waitForTimeout(400);
  const productionScales = await page.evaluate(measureDockScales, "[data-dock-scale]");
  await page.close();
  await context.close();

  await canvas.locator("#chrome .dock .dk").nth(2).hover();
  await canvas.waitForTimeout(300);
  const canvasScales = await canvas.evaluate(measureDockScales, "#chrome .dock .dk");
  await canvas.context().close();
  const peak = (values: number[]): number => Math.max(...values);
  if (Math.abs(peak(productionScales) - peak(canvasScales)) > 0.03) {
    lines.push(
      `Dock hover magnification peaks at ${peak(productionScales).toFixed(2)}, canvas ${peak(canvasScales).toFixed(2)}`,
    );
  }
  return lines;
}

/**
 * Reads the scale of each dock item. Runs in the page.
 * @param selector The selector of the scaled dock elements.
 * @returns The scale factors in DOM order.
 */
function measureDockScales(selector: string): number[] {
  return [...globalThis.document.querySelectorAll(selector)].map((element) => {
    const style = getComputedStyle(element);
    const independent = Number(style.scale) || 1;
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    return matrix.a * independent;
  });
}

/**
 * Runs the whole audit and writes the report.
 */
async function main(): Promise<void> {
  const canvasPath = resolveCanvasPath(process.argv.slice(2), process.env);
  if (!canvasPath) {
    throw new Error(
      "Pass the canvas HTML path or set FIDELITY_CANVAS, for example /path/to/canvas.html.",
    );
  }
  const { baseUrl, stop } = await startPreview();
  const browser = await chromium.launch();
  try {
    const texts = await auditTexts(browser, canvasPath, baseUrl);
    const states = await auditStates(browser, canvasPath, baseUrl);
    const measurements = await auditMeasurements(browser, canvasPath, baseUrl);
    const layout = await auditLayout(browser, baseUrl);
    const interactions = await auditInteractions(browser, canvasPath, baseUrl);
    const sections: ReportSection[] = [
      { title: "EN/ES text diff", lines: texts.text },
      { title: "Stream and GitHub states", lines: states },
      { title: "Measurements", lines: measurements },
      { title: "Horizontal overflow at 320 to 430", lines: layout.overflow },
      { title: "Console errors", lines: texts.console },
      { title: "Third-party requests", lines: texts.network },
      { title: "Reduced motion", lines: layout.motion },
      { title: "Interactions", lines: interactions },
    ];
    const report = `${formatReport(sections)}\nChecked: ${String(coverage.texts)} canvas strings, ${String(coverage.measurements)} measurements, ${String(coverage.pages)} page loads.\nDocumented exceptions skipped: ${DOCUMENTED_EXCEPTIONS.map((entry) => entry.id).join(", ")}.\n`;
    mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    writeFileSync(path.join(OUTPUT_DIRECTORY, "report.md"), report);
    console.log(report);
    process.exitCode = countDeviations(sections) === 0 ? 0 : 1;
  } finally {
    await browser.close();
    stop();
  }
}

await main();
