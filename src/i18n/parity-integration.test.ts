import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import parityIntegration from "./parity-integration";

function runHook(root: string): void {
  const hook = parityIntegration().hooks["astro:config:done"];
  if (!hook) throw new Error("hook missing");
  const options = {
    config: { root: pathToFileURL(`${root}/`) },
  } as unknown as Parameters<typeof hook>[0];
  void hook(options);
}

describe("parityIntegration", () => {
  test("throws a readable error when a translation is missing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "parity-int-"));
    try {
      mkdirSync(path.join(root, "src", "pages"), { recursive: true });
      mkdirSync(path.join(root, "src", "content"), { recursive: true });
      writeFileSync(path.join(root, "src", "pages", "index.astro"), "");
      expect(() => {
        runHook(root);
      }).toThrow(/Bilingual parity check failed[\s\S]*Page \/ exists in "en" but has no "es" pair/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not throw for the real site", () => {
    expect(() => {
      runHook(path.resolve(import.meta.dir, "..", ".."));
    }).not.toThrow();
  });
});
