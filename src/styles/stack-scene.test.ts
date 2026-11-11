import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ASTRO_DIR = path.join(import.meta.dir, "../../dist/_astro");

/**
 * Lists every `animation:` shorthand value that carries a dashed-ident
 * (`--stack`), which browsers reject as a whole.
 * @param css - The stylesheet text to scan.
 * @returns The offending shorthand values.
 */
const findTimelineInShorthand = (css: string): string[] =>
  css
    .matchAll(/(?:^|[;{}\s])animation:([^;}]*)/g)
    .map((match) => match[1] ?? "")
    .filter((value) => /(?:^|[\s,])--[\w-]+/.test(value))
    .toArray();

const builtStackSceneCss = (): string[] =>
  existsSync(ASTRO_DIR)
    ? readdirSync(ASTRO_DIR)
        .filter((name) => /^stack-scene.*\.css$/.test(name))
        .map((name) => readFileSync(path.join(ASTRO_DIR, name), "utf8"))
    : [];

describe("findTimelineInShorthand", () => {
  test("flags a minified shorthand that swallowed the timeline", () => {
    const css =
      ".a{animation:cubic-bezier(.3,0,.7,1) both stack-tile-move --stack,linear both stack-tile-fade --stack}";
    expect(findTimelineInShorthand(css)).toHaveLength(1);
  });

  test("accepts longhands and plain shorthands", () => {
    const css = ".a{animation-name:x;animation-timeline:--stack}.b{animation:fade .2s ease}";
    expect(findTimelineInShorthand(css)).toEqual([]);
  });
});

describe("source stack-scene.css", () => {
  const source = readFileSync(path.join(import.meta.dir, "stack-scene.css"), "utf8");

  test("never writes the animation shorthand next to a timeline", () => {
    expect(findTimelineInShorthand(source)).toEqual([]);
  });

  test("declares the timeline on the animated elements", () => {
    expect(source).toMatch(/animation-timeline:\s*--stack/);
  });
});

describe("built stack-scene CSS (needs dist from a build)", () => {
  const built = builtStackSceneCss();

  test.skipIf(built.length === 0)("has no --stack inside an animation value", () => {
    for (const css of built) {
      expect(css).toContain("--stack");
      expect(findTimelineInShorthand(css)).toEqual([]);
    }
  });
});
