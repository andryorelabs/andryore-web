import { describe, expect, test } from "bun:test";
import { existsSync, globSync, readFileSync } from "node:fs";
import path from "node:path";

const PAGES_ROOT = path.join(import.meta.dir, "pages");
const LOCAL_ASTRO_IMPORT = /from\s+"(\.[^"]+\.astro)"/g;
const HEADING = /<h([1-6])[\s>]/g;

function importedAstroFiles(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(LOCAL_ASTRO_IMPORT)) {
    const target = path.resolve(path.dirname(file), match[1] ?? "");
    if (existsSync(target)) importedAstroFiles(target, seen);
  }
  return [...seen];
}

function headingLevels(files: readonly string[]): number[] {
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .matchAll(HEADING)
      .map((match) => Number(match[1]))
      .toArray(),
  );
}

const routeFiles = globSync("**/*.astro", { cwd: PAGES_ROOT })
  .map((file) => path.join(PAGES_ROOT, file))
  .toSorted((left, right) => left.localeCompare(right));

describe("route html structure", () => {
  test("finds the routes of both languages", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(10);
    expect(routeFiles.some((file) => file.endsWith("404.astro"))).toBe(true);
  });

  for (const file of routeFiles) {
    const route = path.relative(PAGES_ROOT, file);
    const files = importedAstroFiles(file);
    const levels = headingLevels(files);

    test(`${route} has exactly one h1`, () => {
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
    });

    test(`${route} never skips a heading level`, () => {
      const present = new Set(levels);
      for (const level of present) {
        if (level > 1) expect(present.has(level - 1)).toBe(true);
      }
    });

    test(`${route} renders inside the base layout`, () => {
      const layoutUsers = files.filter((candidate) =>
        readFileSync(candidate, "utf8").includes("<BaseLayout"),
      );
      expect(layoutUsers.length).toBeGreaterThan(0);
    });
  }
});
