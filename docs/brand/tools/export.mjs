import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

import {
  assertSpec as assertImageSpec,
  AVATAR_SIZE,
  bannerHtml as buildBannerHtml,
  panelHtml as buildPanelHtml,
  FORMATS,
  KB,
  MARK_SIZES,
  PANEL_HEIGHT,
  PANEL_LABELS,
  PANEL_MAX_BYTES,
  PANEL_WIDTH,
} from "./brand-export-spec.mjs";

/**
 * Regenerates the derived raster assets of the brand kit from the SVG sources in
 * `docs/brand/logo`: the PNG marks, the Open Graph image (`docs/brand/og/`),
 * the per-language Open Graph images and the site icons in `public/`, the
 * social banners and the fallback avatars (`docs/brand/social/`). Run with
 * `bun run brand:export`.
 *
 * Fonts are embedded from `docs/brand/brandbook/fonts`, so output does not
 * depend on fonts installed on the host. The script throws when an image
 * misses its exact pixel size or byte budget.
 */
const brandRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(brandRoot, "../..");
const fontsRoot = path.join(brandRoot, "brandbook/fonts");

const SITE_ICONS = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

const browser = await chromium.launch();

const readLogo = (fileName) => readFile(path.join(brandRoot, "logo", fileName), "utf8");
const markSvg = await readLogo("mark.svg");
const markDarkSvg = await readLogo("mark-dark.svg");
const markGridSvg = await readLogo("mark-grid.svg");
const wordmarkSvgs = {
  dark: await readLogo("wordmark-dark.svg"),
  light: await readLogo("wordmark.svg"),
};

const fontRules = await Promise.all(
  [
    ["Space Grotesk", "SpaceGrotesk-var.woff2", "300 700"],
    ["JetBrains Mono", "JetBrainsMono-var.woff2", "100 800"],
  ].map(async ([family, fileName, weight]) => {
    const fontFile = await readFile(path.join(fontsRoot, fileName));
    const data = fontFile.toString("base64");
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  }),
);
const fontFaces = fontRules.join("");

function assertSpec(outPath, spec) {
  return assertImageSpec(outPath, spec, { repositoryRoot });
}

async function renderSvg(svg, size, outPath) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>svg{display:block;width:100%;height:100%}</style>` +
      `<body style="margin:0;width:${size}px;height:${size}px">${svg}</body>`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: true });
  await page.close();
  await assertSpec(outPath, { width: size, height: size, maxBytes: 200 * KB });
}

async function renderBanner(format, outPath, locale = "en") {
  const theme = "dark";
  const { width, height, maxBytes } = FORMATS[format];
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(
    buildBannerHtml({
      format,
      theme,
      wordmarkSvg: wordmarkSvgs[theme],
      fontFaces,
      locale,
    }),
  );
  await page.waitForFunction('document.fonts.status === "loaded"');
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buffer).png({ compressionLevel: 9, palette: true }).toFile(outPath);
  await assertSpec(outPath, { width, height, maxBytes });
}

async function renderPanel(label, outPath) {
  const page = await browser.newPage({
    viewport: { width: PANEL_WIDTH, height: PANEL_HEIGHT },
  });
  await page.setContent(buildPanelHtml({ label, fontFaces }));
  await page.waitForFunction('document.fonts.status === "loaded"');
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buffer).png({ compressionLevel: 9, palette: true }).toFile(outPath);
  await assertSpec(outPath, {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    maxBytes: PANEL_MAX_BYTES,
  });
}

try {
  for (const size of MARK_SIZES) {
    await renderSvg(markSvg, size, path.join(brandRoot, "logo/png", `mark-${size}.png`));
  }
  await renderBanner("og", path.join(brandRoot, "og/og.png"));
  for (const locale of ["en", "es"]) {
    await renderBanner("og", path.join(brandRoot, "og", `og-${locale}.png`), locale);
  }
  for (const [fileName, size] of SITE_ICONS) {
    await renderSvg(markGridSvg, size, path.join(repositoryRoot, "public", fileName));
  }
  for (const format of [
    "x-header",
    "linkedin-banner",
    "youtube-banner",
    "twitch-banner",
    "twitch-offline",
  ]) {
    await renderBanner(format, path.join(brandRoot, "social", `${format}.png`));
  }
  for (const label of PANEL_LABELS) {
    await renderPanel(label, path.join(brandRoot, "social/twitch-panels", `${label}.png`));
  }
  await renderSvg(markSvg, AVATAR_SIZE, path.join(brandRoot, "social/avatar-ao.png"));
  await renderSvg(markDarkSvg, AVATAR_SIZE, path.join(brandRoot, "social/avatar-ao-dark.png"));
  await renderSvg(markGridSvg, AVATAR_SIZE, path.join(brandRoot, "social/avatar-ao-grid.png"));
} finally {
  await browser.close();
}
