import { describe, expect, test } from "bun:test";

import {
  BASELINE_TEST_FILE_GLOBS,
  OXLINT_BASELINE_RULES,
  OXLINT_BASELINE_TEST_RULES,
} from "./oxlint-baseline.mjs";

describe("the Oxlint baseline rule maps", () => {
  test("set every rule to error", () => {
    const settings = Object.values({
      ...OXLINT_BASELINE_RULES,
      ...OXLINT_BASELINE_TEST_RULES,
    });
    for (const setting of settings) {
      expect(Array.isArray(setting) ? (setting as unknown[])[0] : setting).toBe("error");
    }
  });

  test("carry the baseline options", () => {
    expect(OXLINT_BASELINE_RULES["typescript/return-await"]).toEqual(["error", "in-try-catch"]);
    expect(OXLINT_BASELINE_RULES["import/no-unassigned-import"]).toEqual([
      "error",
      { allow: ["**/*.css", "@fontsource/**", "@fontsource-variable/**"] },
    ]);
  });

  test("keep the test-integrity rules out of the every-file map", () => {
    expect(Object.keys(OXLINT_BASELINE_TEST_RULES)).toEqual([
      "jest/no-focused-tests",
      "jest/no-identical-title",
      "local/no-bun-test-only",
      "local/no-unawaited-async-matcher",
    ]);
    expect(OXLINT_BASELINE_RULES["jest/no-focused-tests"]).toBeUndefined();
  });

  test("apply the test rules to test and spec files", () => {
    expect(BASELINE_TEST_FILE_GLOBS).toContain("**/*.test.ts");
    expect(BASELINE_TEST_FILE_GLOBS).toContain("**/*.spec.ts");
  });
});
