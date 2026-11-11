import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runParityCheck } from "./parity-check";

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "..", "..");
const temporaryRoots: string[] = [];

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "parity-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "src", "pages"), { recursive: true });
  mkdirSync(path.join(root, "src", "content"), { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runParityCheck", () => {
  test("the real site is in parity", () => {
    expect(runParityCheck(REPOSITORY_ROOT)).toEqual([]);
  });

  test("passes for a paired page tree", () => {
    const root = fixture({
      "src/pages/index.astro": "",
      "src/pages/es/index.astro": "",
      "src/pages/about/index.astro": "",
      "src/pages/es/about/index.astro": "",
    });
    expect(runParityCheck(root)).toEqual([]);
  });

  test("fails when a page lacks its Spanish pair", () => {
    const root = fixture({
      "src/pages/index.astro": "",
      "src/pages/es/index.astro": "",
      "src/pages/about/index.astro": "",
    });
    expect(runParityCheck(root)).toEqual(['Page /about/ exists in "en" but has no "es" pair.']);
  });

  test("fails when a content entry lacks its translation", () => {
    const root = fixture({
      "src/pages/index.astro": "",
      "src/pages/es/index.astro": "",
      "src/content/products/hello.en.md": "---\nlang: en\nkey: hello\n---\nBody",
    });
    expect(runParityCheck(root)).toEqual([
      'Content entry "hello" (src/content/products/hello.en.md) has no "es" translation.',
    ]);
  });

  test("accepts paired entries", () => {
    const root = fixture({
      "src/pages/index.astro": "",
      "src/pages/es/index.astro": "",
      "src/content/products/hello.en.md": "---\nlang: en\nkey: hello\n---\n",
      "src/content/products/hello.es.md": "---\nlang: es\nkey: hello\n---\n",
    });
    expect(runParityCheck(root)).toEqual([]);
  });

  test("checks UI strings: parity, duplicates, copy and reachability", () => {
    const root = fixture({
      "src/pages/index.astro": "{copy.used}",
      "src/pages/es/index.astro": "",
      "src/content/ui.json":
        '{"en":{"used":"Hi {name}","orphan":"TODO"},"es":{"used":"Hola {nombre}","used":"x"}}',
    });
    const problems = runParityCheck(root);
    expect(problems).toContain('src/content/ui.json: duplicate key "used".');
    expect(problems.some((problem) => problem.includes('"orphan" is missing in "es"'))).toBe(true);
    expect(problems.some((problem) => problem.includes("leaked TODO"))).toBe(true);
    expect(problems.some((problem) => problem.includes('"orphan" is not used'))).toBe(true);
  });
});
