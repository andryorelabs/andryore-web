import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

type Rgb = [number, number, number];

interface ContrastPair {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
}

const TEXT_MINIMUM = 4.5;
const UI_MINIMUM = 3;

const tokensCss = readFileSync(new URL("tokens.css", import.meta.url), "utf8");

function pairsAt(minimum: number, names: readonly (readonly [string, string])[]): ContrastPair[] {
  return names.map(([foreground, background]) => ({
    foreground,
    background,
    minimum,
  }));
}

const textPairs = pairsAt(TEXT_MINIMUM, [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["accent-foreground", "accent"],
  ["destructive", "background"],
  ["success", "background"],
]);

const uiPairs = pairsAt(UI_MINIMUM, [
  ["ring", "background"],
  ["ring", "card"],
  ["primary", "background"],
]);

function tokenValue(block: string, name: string): string {
  const match = new RegExp(String.raw`--${name}:\s*([^;]+);`).exec(block);
  if (!match) throw new Error(`Missing --${name}`);
  return (match[1] ?? "").trim();
}

function resolveToken(block: string, name: string, visited: readonly string[] = []): string {
  if (visited.includes(name)) throw new Error(`Circular --${name}`);
  const value = tokenValue(block, name);
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  return reference ? resolveToken(block, reference[1] ?? "", [...visited, name]) : value;
}

function themeBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block`);
  return css.slice(start, css.indexOf("\n}", start));
}

function oklchToLinearRgb(lightness: number, chroma: number, hue: number): Rgb {
  const hueRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function parseOklch(value: string): Rgb {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!match) throw new Error(`Unsupported colour: ${value}`);
  return oklchToLinearRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: Rgb, second: Rgb): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
}

function colourOf(block: string, name: string): Rgb {
  return parseOklch(resolveToken(block, name));
}

function findFailingPairs(block: string, pairs: readonly ContrastPair[]): string[] {
  return pairs
    .map(({ foreground, background, minimum }) => ({
      foreground,
      background,
      minimum,
      ratio: contrast(colourOf(block, foreground), colourOf(block, background)),
    }))
    .filter(({ ratio, minimum }) => ratio < minimum)
    .map(
      ({ foreground, background, minimum, ratio }) =>
        `${foreground} on ${background}: ${ratio.toFixed(2)} < ${String(minimum)}`,
    );
}

describe("contrast checker", () => {
  const fixture = `.fixture {
  --ink: var(--paper);
  --paper: oklch(0.9 0 0);
  --faint: oklch(0.85 0 0);
}`;

  it("resolves var() chains", () => {
    expect(resolveToken(fixture, "ink")).toBe("oklch(0.9 0 0)");
  });

  it("rejects circular references", () => {
    expect(() => resolveToken("--a: var(--b);\n--b: var(--a);", "a")).toThrow("Circular");
  });

  it("reports a low-contrast pair", () => {
    const failures = findFailingPairs(fixture, [
      { foreground: "faint", background: "paper", minimum: TEXT_MINIMUM },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("faint on paper");
  });

  it("accepts black on white", () => {
    const block = "--a: oklch(0 0 0);\n--b: oklch(1 0 0);";
    expect(
      findFailingPairs(block, [{ foreground: "a", background: "b", minimum: TEXT_MINIMUM }]),
    ).toEqual([]);
  });
});

describe.each([
  ["light", ":root"],
  ["dark", ".dark"],
])("%s theme brand tokens", (_name, selector) => {
  const block = themeBlock(tokensCss, selector);

  it(`keeps text pairs at least ${String(TEXT_MINIMUM)}:1`, () => {
    expect(findFailingPairs(block, textPairs)).toEqual([]);
  });

  it(`keeps UI and focus pairs at least ${String(UI_MINIMUM)}:1`, () => {
    expect(findFailingPairs(block, uiPairs)).toEqual([]);
  });
});
