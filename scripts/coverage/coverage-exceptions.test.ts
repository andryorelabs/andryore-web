import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";

import { FILE_FUNCTION_FLOOR, FILE_LINE_FLOOR } from "./check-threshold";
import { coverageExceptions } from "./coverage-exceptions";

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../..");

describe("coverageExceptions", () => {
  test("lists each file once, and each file exists", () => {
    const paths = coverageExceptions.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const entry of paths) expect(existsSync(path.join(REPOSITORY_ROOT, entry))).toBe(true);
  });

  test("keeps every floor under the per-file floor, so an entry is a real exception", () => {
    for (const entry of coverageExceptions) {
      const isUnderFloor = entry.lines < FILE_LINE_FLOOR || entry.functions < FILE_FUNCTION_FLOOR;
      expect(isUnderFloor).toBe(true);
    }
  });

  test("gives every entry a concrete reason that is not a TODO", () => {
    for (const entry of coverageExceptions) {
      expect(entry.reason.trim().length).toBeGreaterThan(40);
      expect(entry.reason).not.toMatch(/\btodo\b/i);
    }
  });
});
