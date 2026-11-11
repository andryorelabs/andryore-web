/**
One text mismatch: a canvas string the rendered Site does not contain.
 */
export interface TextDeviation {
  readonly scene: string;
  readonly text: string;
}

/**
One measured property compared with its expected value.
 */
export interface MeasurementResult {
  readonly id: string;
  readonly scene: string;
  readonly expected: number;
  readonly actual: number | undefined;
}

/**
A named block of the report with the deviations it found.
 */
export interface ReportSection {
  readonly title: string;
  readonly lines: readonly string[];
}

/**
 * Collapses whitespace and typographic quote variants so two renderings of
 * the same string compare equal.
 * @param value The raw text.
 * @returns The normalized text.
 */
export function normalizeText(value: string): string {
  return value
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll("\u{A0}", " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Lists the canvas strings missing from the rendered text, skipping the ones
 * that match a documented exception.
 * @param scene The scene label used in the report.
 * @param canvasTexts The leaf strings read from the canvas.
 * @param renderedTexts The leaf strings read from the rendered Site.
 * @param ignored Patterns for documented exceptions and live data.
 * @returns The canvas strings that are not rendered.
 */
export function findMissingTexts(
  scene: string,
  canvasTexts: readonly string[],
  renderedTexts: readonly string[],
  ignored: readonly RegExp[],
): TextDeviation[] {
  const normalized = renderedTexts.map((value) => normalizeText(value));
  const spaced = normalized.join(" ").toLowerCase();
  const tight = normalized.join("").toLowerCase();
  const missing = new Map<string, TextDeviation>();
  for (const raw of canvasTexts) {
    const text = normalizeText(raw);
    const lowered = text.toLowerCase();
    if (
      text === "" ||
      spaced.includes(lowered) ||
      tight.includes(lowered) ||
      ignored.some((pattern) => pattern.test(text))
    )
      continue;
    missing.set(text, { scene, text });
  }
  return missing.values().toArray();
}

/**
 * Tells whether a measured value matches the expected one.
 * @param actual The measured value, if the element was found.
 * @param expected The expected value.
 * @param tolerance The allowed absolute difference.
 * @returns True when the value is within tolerance.
 */
export function isWithinTolerance(
  actual: number | undefined,
  expected: number,
  tolerance: number,
): boolean {
  return actual !== undefined && Math.abs(actual - expected) <= tolerance;
}

/**
 * Parses a computed CSS length such as `20px`.
 * @param value The computed value.
 * @returns The number of pixels, or undefined when it is not a pixel length.
 */
export function parsePixels(value: string): number | undefined {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/**
 * Keeps the measurements that miss their expected value.
 * @param results Every measurement taken.
 * @param tolerance The allowed absolute difference in pixels.
 * @returns The failing measurements.
 */
export function failedMeasurements(
  results: readonly MeasurementResult[],
  tolerance: number,
): MeasurementResult[] {
  return results.filter((result) => !isWithinTolerance(result.actual, result.expected, tolerance));
}

/**
 * Counts the lines of every section.
 * @param sections The report sections.
 * @returns The total number of deviations.
 */
export function countDeviations(sections: readonly ReportSection[]): number {
  return sections.reduce((total, section) => total + section.lines.length, 0);
}

/**
 * Renders the audit report as Markdown.
 * @param sections Every audit section with its deviation lines.
 * @returns The report text, ending with the total.
 */
export function formatReport(sections: readonly ReportSection[]): string {
  const blocks = sections.map((section) => {
    const body =
      section.lines.length === 0 ? "- none" : section.lines.map((line) => `- ${line}`).join("\n");
    return `## ${section.title} (${String(section.lines.length)})\n\n${body}`;
  });
  const total = countDeviations(sections);
  return `# Fidelity audit\n\n${blocks.join("\n\n")}\n\nTotal deviations: ${String(total)}\n`;
}

/**
 * Resolves the canvas path from the command line or the environment.
 * @param argv The arguments after the script name.
 * @param environment The process environment.
 * @returns The canvas path, or undefined when none was given.
 */
export function resolveCanvasPath(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return argv.find((argument) => !argument.startsWith("-")) ?? environment.FIDELITY_CANVAS;
}

/**
 * Labels one overflow finding with the page state that produced it.
 * @param state The route, language, theme, width and scroll of the page.
 * @param state.route The route path.
 * @param state.language The page language.
 * @param state.theme The color theme.
 * @param state.width The viewport width in pixels.
 * @param state.scrolled Whether the page was scrolled before measuring.
 * @param finding One line from `findHorizontalOverflow`.
 * @returns The report line.
 */
export function describeOverflow(
  state: {
    readonly route: string;
    readonly language: string;
    readonly theme: string;
    readonly width: number;
    readonly scrolled: boolean;
  },
  finding: string,
): string {
  const scroll = state.scrolled ? "scrolled" : "top";
  return `${state.route} ${state.language} ${state.theme} @${String(state.width)} ${scroll}: ${finding}`;
}

/**
A deviation the audit does not report because the owner accepted it.
 */
export interface DocumentedException {
  readonly id: string;
  readonly reason: string;
}

/**
Every accepted deviation from the canvas, mirrored in docs/development.md.
 */
export const DOCUMENTED_EXCEPTIONS: readonly DocumentedException[] = [
  {
    id: "about-uses-home-link",
    reason: "The Home link on About and Uses is Site navigation the canvas lacks.",
  },
  {
    id: "snug-store-button",
    reason: "The Snug header has a Chrome Web Store button the canvas lacks.",
  },
  {
    id: "header-blurred-surface",
    reason:
      "The header floats as a blurred pill after scroll, as canvas v29 shows; the canvas stays plain at the top.",
  },
  {
    id: "hero-art-border-shadow",
    reason: "The hero art border and shadow follow the Site tokens, not the canvas.",
  },
  {
    id: "epidemic-sound-files",
    reason: "The licensed sound files are absent from local and CI builds.",
  },
  {
    id: "astro-badge-dark-text",
    reason: "The Astro badge keeps dark text in both themes.",
  },
  {
    id: "json-flow-no-website-tile",
    reason: "JSON Flow has no website tile.",
  },
  {
    id: "404-tiles-behind-content-390",
    reason: "The 404 tiles sit behind the content at 390 px.",
  },
  {
    id: "dock-compact-buttons-phones",
    reason:
      "Below 400 px the dock buttons shrink to 36 px (34 px under 360 px) so the dock fits phones.",
  },
  {
    id: "404-reduced-motion-positions",
    reason: "With reduced motion the 404 tiles keep their positions.",
  },
];

const COMPACT_DOCK_BUTTON_TOLERANCE = 2;

/**
 * Tells whether a failed measurement is a documented exception. The compact
 * dock button only counts when it really measures 36 px (34 px under 360 px),
 * so a hidden or broken dock still fails.
 * @param measurementId The measurement id with its viewport, e.g. `x @390`.
 * @param actual The measured value, or undefined when nothing matched.
 * @returns True when the owner accepted the deviation.
 */
export function isDocumentedMeasurement(measurementId: string, actual?: number): boolean {
  const match = /^dock button width @(\d+)$/.exec(measurementId);
  if (match === null || actual === undefined) return false;
  const width = Number(match[1]);
  if (width >= 400) return false;
  const compact = width < 360 ? 34 : 36;
  return Math.abs(actual - compact) <= COMPACT_DOCK_BUTTON_TOLERANCE;
}

/**
 * Tells whether a console error is the 404 of a sound file, a documented
 * exception because the licensed files are absent from local and CI builds.
 * @param text The console message text.
 * @param url The URL that produced the message.
 * @returns True when the message is a missing sound asset.
 */
export function isMissingSoundAsset(text: string, url: string): boolean {
  return text.includes("status of 404") && new URL(url).pathname.startsWith("/sounds/");
}
