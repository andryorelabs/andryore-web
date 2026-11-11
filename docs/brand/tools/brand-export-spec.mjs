import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const THEMES = {
  dark: {
    ground: "#0D1117",
    text: "#E8ECF2",
    muted: "#9AA4B2",
    faint: "#5B6575",
    accent: "#5C8BFF",
    accentRgb: "92,139,255",
  },
  light: {
    ground: "#F1F3F6",
    text: "#15191F",
    muted: "#4B5563",
    faint: "#8A94A3",
    accent: "#1F5CFF",
    accentRgb: "31,92,255",
  },
};

export const KB = 1024;
export const MB = 1024 * KB;
export const MARK_SIZES = [16, 32, 48, 128, 512];
export const AVATAR_SIZE = 800;
export const PANEL_WIDTH = 320;
export const PANEL_HEIGHT = 72;
export const PANEL_MAX_BYTES = 100 * KB;
export const PANEL_LABELS = ["about", "schedule", "links", "rules", "setup", "commands"];

const HEADLINES = {
  en: {
    defaultLines: ["Building, exploring, "],
    specLines: ["Building, exploring,", ""],
    accent: "telling",
  },
  es: {
    defaultLines: ["Construyendo, explorando, "],
    specLines: ["Construyendo, explorando,", ""],
    accent: "contando",
  },
};
const HANDLE = "@andryore &middot; andryore.dev";
const GHOST_WORD = "TRY";
const DESIGN_WIDTH = 1500;

/**
 * Banner formats, all sizes in design pixels at native resolution.
 * - `headlineSize` must stay at or above `minHeadlinePx`: banners are shown far
 *   below native size, so the sentence has to survive the downscale.
 * - `display` is the typical on-screen scale (shown width over native width).
 * - `safe` is the area that survives each platform's crop; omitted means the
 *   whole canvas minus the margins.
 * - `lines` overrides the default two-line headline break; the accent phrase
 *   follows the last entry.
 * - `handle` overrides the default handle line (HTML-escaped by the caller).
 * - `devices` turns on the wallpaper devices that only read on large surfaces.
 */
export const FORMATS = {
  og: {
    width: 1200,
    height: 630,
    maxBytes: 300 * KB,
    headlineSize: 80,
    minHeadlinePx: 56,
    handleSize: 28,
    wordmarkWidth: 300,
    lines: ["Building, exploring,", ""],
    display: { desktop: 0.45, phone: 0.3 },
    devices: { ghost: true, dimension: true },
  },
  "x-header": {
    width: 1500,
    height: 500,
    maxBytes: 1 * MB,
    headlineSize: 100,
    minHeadlinePx: 64,
    handleSize: 28,
    wordmarkWidth: 0,
    display: { desktop: 0.4, phone: 0.26 },
    devices: { ghost: false, dimension: false },
  },
  "linkedin-banner": {
    width: 1584,
    height: 396,
    maxBytes: 1 * MB,
    headlineSize: 80,
    minHeadlinePx: 56,
    handleSize: 26,
    wordmarkWidth: 0,
    lines: ["Building, exploring,", ""],
    safe: { left: 760, top: 40, width: 728, height: 316 },
    display: { desktop: 0.71, phone: 0.25 },
    devices: { ghost: false, dimension: false },
  },
  "youtube-banner": {
    width: 2560,
    height: 1440,
    maxBytes: 1.5 * MB,
    headlineSize: 116,
    minHeadlinePx: 100,
    handleSize: 44,
    wordmarkWidth: 0,
    safe: { left: 507, top: 508, width: 1546, height: 423 },
    display: { desktop: 0.6, phone: 0.23 },
    devices: { ghost: true, dimension: true },
  },
  "twitch-banner": {
    width: 1200,
    height: 480,
    maxBytes: 1 * MB,
    headlineSize: 72,
    minHeadlinePx: 48,
    handleSize: 24,
    wordmarkWidth: 0,
    lines: ["Building, exploring,", ""],
    handle: "twitch.tv/andryoredev &middot; andryore.dev",
    display: { desktop: 0.6, phone: 0.25 },
    devices: { ghost: false, dimension: false },
  },
  "twitch-offline": {
    width: 1920,
    height: 1080,
    maxBytes: 1.5 * MB,
    headlineSize: 120,
    minHeadlinePx: 100,
    handleSize: 36,
    wordmarkWidth: 0,
    lines: ["Building, exploring,", ""],
    handle: "twitch.tv/andryoredev &middot; andryore.dev",
    safe: { left: 192, top: 100, width: 1536, height: 560 },
    display: { desktop: 0.65, phone: 0.2 },
    devices: { ghost: true, dimension: false },
  },
};

/**
 * Size a native pixel value takes on screen.
 * @param nativePx Size at native resolution.
 * @param scale Shown width over native width.
 * @returns The on-screen size in pixels, one decimal.
 */
export function effectiveSize(nativePx, scale) {
  return Math.round(nativePx * scale * 10) / 10;
}

/**
 * On-screen headline size of a banner format on desktop and phone.
 * @param format Key of {@link FORMATS}.
 * @returns The headline size at each display scale.
 */
export function headlineOnScreen(format) {
  const { headlineSize, display } = FORMATS[format];
  return {
    desktop: effectiveSize(headlineSize, display.desktop),
    phone: effectiveSize(headlineSize, display.phone),
  };
}

/**
 * Builds the HTML of a brand banner. Pure: the wordmark SVG and the embedded
 * font CSS are inputs, so no file or browser is needed.
 * @param options Banner inputs.
 * @param options.format Key of {@link FORMATS}.
 * @param options.theme Colour theme, `dark` or `light`.
 * @param options.wordmarkSvg Inline SVG of the wordmark.
 * @param options.fontFaces CSS `@font-face` rules with embedded fonts.
 * @param [options.locale] Headline language, `en` (default) or `es`.
 * @returns The banner document HTML.
 */
export function bannerHtml({ format, theme, wordmarkSvg, fontFaces, locale = "en" }) {
  const spec = FORMATS[format];
  if (!spec) throw new Error(`Unknown banner format: ${format}`);
  const headline = HEADLINES[locale];
  if (!headline) throw new Error(`Unknown banner locale: ${locale}`);
  const lines = spec.lines ? headline.specLines : headline.defaultLines;
  const { ground, text, muted, faint, accent, accentRgb } = THEMES[theme];
  const { width, height, headlineSize, handleSize, wordmarkWidth, devices } = spec;
  const unit = width / DESIGN_WIDTH;
  const margin = Math.round(96 * unit);
  const safe = spec.safe ?? {
    left: margin,
    top: margin,
    width: width - 2 * margin,
    height: height - 2 * margin,
  };
  const stroke = Math.max(2, Math.round(2 * unit));
  const cell = Math.round(50 * unit);
  const bracketSize = Math.round(40 * unit);
  const bracketInset = Math.round(32 * unit);
  const bracketLine = `${Math.max(2, Math.round(3 * unit))}px solid rgba(${accentRgb},0.45)`;
  const decoSize = Math.round(18 * unit);
  const bracket = (vertical, horizontal) =>
    `<div style="position:absolute;${vertical}:${bracketInset}px;${horizontal}:${bracketInset}px;width:${bracketSize}px;height:${bracketSize}px;border-${vertical}:${bracketLine};border-${horizontal}:${bracketLine}"></div>`;
  const ghost = devices.ghost
    ? `<div style="position:absolute;right:${margin}px;bottom:${Math.round(margin * 0.9)}px;font-weight:700;font-size:${Math.round(height * 0.3)}px;letter-spacing:-0.04em;line-height:0.8;color:transparent;-webkit-text-stroke:${stroke}px rgba(${accentRgb},0.2)">${GHOST_WORD}</div>`
    : "";
  const dimension = devices.dimension
    ? `<div style="position:absolute;left:${margin}px;right:${margin}px;bottom:${Math.round(margin * 0.55)}px;height:${stroke}px;background:rgba(${accentRgb},0.5)"></div>
       <div style="position:absolute;left:${margin}px;bottom:${Math.round(margin * 0.55 - 8 * unit)}px;width:${stroke}px;height:${Math.round(18 * unit)}px;background:rgba(${accentRgb},0.5)"></div>
       <div style="position:absolute;right:${margin}px;bottom:${Math.round(margin * 0.55 - 8 * unit)}px;width:${stroke}px;height:${Math.round(18 * unit)}px;background:rgba(${accentRgb},0.5)"></div>
       <div style="position:absolute;left:0;right:0;bottom:${Math.round(margin * 0.55 + 12 * unit)}px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${decoSize}px;letter-spacing:0.14em;color:${faint}">${width - 2 * margin}</div>`
    : "";
  const wordmark = wordmarkWidth
    ? `<div style="width:${wordmarkWidth}px;margin-bottom:${Math.round(headlineSize * 0.5)}px">${wordmarkSvg}</div>`
    : "";
  return `<html lang="${locale}"><style>${fontFaces}svg{display:block;width:100%;height:auto}</style>
    <body style="margin:0;width:${width}px;height:${height}px;position:relative;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;color:${text};background-color:${ground};background-image:linear-gradient(rgba(${accentRgb},0.08) ${stroke}px,transparent ${stroke}px),linear-gradient(90deg,rgba(${accentRgb},0.08) ${stroke}px,transparent ${stroke}px);background-size:${cell}px ${cell}px">
      ${ghost}
      ${bracket("top", "left")}${bracket("top", "right")}${bracket("bottom", "left")}${bracket("bottom", "right")}
      <div style="position:absolute;left:${margin}px;top:${Math.round(margin * 0.5)}px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${decoSize}px;letter-spacing:0.14em;color:${accent}">01</div>
      <div style="position:absolute;right:${margin}px;top:${Math.round(margin * 0.5)}px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${decoSize}px;letter-spacing:0.14em;color:${faint}">${width} &times; ${height}</div>
      <div style="position:absolute;left:${safe.left}px;top:${safe.top}px;width:${safe.width}px;height:${safe.height}px;display:flex;flex-direction:column;align-items:${wordmarkWidth ? "flex-start" : "center"};justify-content:center">
        ${wordmark}
        <div style="font-weight:700;font-size:${headlineSize}px;letter-spacing:-0.035em;line-height:1.05;text-align:${wordmarkWidth ? "left" : "center"}">${lines.join("<br>")}<span style="color:${accent}">${headline.accent}</span>.</div>
        <div style="display:flex;align-items:center;gap:${Math.round(handleSize * 0.5)}px;margin-top:${Math.round(headlineSize * 0.35)}px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:${handleSize}px;letter-spacing:0.1em;color:${muted}">
          <span style="display:inline-block;width:${Math.round(handleSize * 0.4)}px;height:${Math.round(handleSize * 0.4)}px;background:${accent}"></span><span>${spec.handle ?? HANDLE}</span>
        </div>
      </div>
      ${dimension}
    </body></html>`;
}

/**
 * Builds the HTML of a Twitch panel header: a mono label with the accent
 * square on the brand ground. Pure, like {@link bannerHtml}.
 * @param options Panel inputs.
 * @param options.label One of {@link PANEL_LABELS}.
 * @param options.fontFaces CSS `@font-face` rules with embedded fonts.
 * @returns The panel document HTML.
 */
export function panelHtml({ label, fontFaces }) {
  if (!PANEL_LABELS.includes(label)) {
    throw new Error(`Unknown panel label: ${label}`);
  }
  const { ground, muted, accent, accentRgb } = THEMES.dark;
  return `<html lang="en"><style>${fontFaces}</style>
    <body style="margin:0;width:${PANEL_WIDTH}px;height:${PANEL_HEIGHT}px;position:relative;overflow:hidden;font-family:'JetBrains Mono',ui-monospace,monospace;background-color:${ground};background-image:linear-gradient(rgba(${accentRgb},0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(${accentRgb},0.08) 1px,transparent 1px);background-size:24px 24px">
      <div style="position:absolute;left:20px;top:0;bottom:0;display:flex;align-items:center;gap:12px;font-size:20px;letter-spacing:0.14em;text-transform:uppercase;color:${muted}">
        <span style="display:inline-block;width:10px;height:10px;background:${accent}"></span><span>${label}</span>
      </div>
    </body></html>`;
}

/**
 * Throws when the image at `outPath` misses its exact pixel size or exceeds
 * its byte budget; otherwise logs its path relative to `repositoryRoot` and
 * its size in KB. `log` defaults to `console.log`.
 * @param outPath Path of the image to check.
 * @param spec Expected image properties.
 * @param spec.width Expected width in pixels.
 * @param spec.height Expected height in pixels.
 * @param spec.maxBytes Maximum file size in bytes.
 * @param [options] Reporting options.
 * @param [options.repositoryRoot] Base for the logged relative path.
 * @param [options.log] Success logger.
 * @returns Resolves when the image meets the spec.
 */
export async function assertSpec(
  outPath,
  { width, height, maxBytes },
  { repositoryRoot = process.cwd(), log = console.log } = {},
) {
  const { size } = await stat(outPath);
  const meta = await sharp(outPath).metadata();
  const name = path.basename(outPath);
  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${name} is ${meta.width}x${meta.height}, expected ${width}x${height}`);
  }
  if (size > maxBytes) {
    throw new Error(`${name} is ${size} bytes, over ${maxBytes}`);
  }
  log(`${path.relative(repositoryRoot, outPath)} ${(size / KB).toFixed(0)} KB`);
}
