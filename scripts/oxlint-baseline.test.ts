import { describe, expect, test } from "bun:test";

import oxlintConfig from "../oxlint.config";
import baseline from "./oxlint-baseline.json";

type RuleMap = Record<string, unknown>;

/**
 * The parts of an Oxlint config that decide which rules a file gets.
 */
interface ResolvableConfig {
  rules?: RuleMap;
  overrides?: { files: string[]; rules?: RuleMap }[];
}

/**
 * The rules Oxlint applies to a file: the base rules, then every matching
 * override in order, a later value replacing an earlier one.
 * @param config An Oxlint config.
 * @param file A repo-relative path.
 * @returns Every rule setting that applies to the file.
 */
function resolveRules(config: ResolvableConfig, file: string): RuleMap {
  const resolved: RuleMap = { ...config.rules };
  const overrides = config.overrides ?? [];
  for (const override of overrides) {
    if (override.files.some((glob) => new Bun.Glob(glob).match(file))) {
      Object.assign(resolved, override.rules);
    }
  }
  return resolved;
}

/**
 * The severity of a rule setting, `"error"` or `["error", ...options]`.
 * @param setting A rule setting.
 * @returns Its severity, or `undefined` when the rule is not set.
 */
function severityOf(setting: unknown): unknown {
  return Array.isArray(setting) ? (setting as unknown[])[0] : setting;
}

/**
 * Baseline rules a file does not get at error level.
 * @param config An Oxlint config.
 * @param file A repo-relative path.
 * @param ruleNames The baseline rule ids the file must get.
 * @returns The missing or weaker rule ids.
 */
function findMissingBaselineRules(
  config: ResolvableConfig,
  file: string,
  ruleNames: readonly string[],
): string[] {
  const resolved = resolveRules(config, file);
  return ruleNames.filter((ruleName) => {
    const severity = severityOf(resolved[ruleName]);
    return severity !== "error" && severity !== 2;
  });
}

describe("the vendored Oxlint baseline (standard rule E10)", () => {
  test("lists every-file and test-file rules", () => {
    expect(baseline.rules.length).toBeGreaterThan(0);
    expect(baseline.testRules).toContain("local/no-bun-test-only");
  });

  test("every baseline rule is an error in a source file", () => {
    expect(findMissingBaselineRules(oxlintConfig, "src/lib/about.ts", baseline.rules)).toEqual([]);
  });

  test("every baseline and test baseline rule is an error in a test file", () => {
    const ruleNames = [...baseline.rules, ...baseline.testRules];
    expect(findMissingBaselineRules(oxlintConfig, "src/lib/about.test.ts", ruleNames)).toEqual([]);
    expect(findMissingBaselineRules(oxlintConfig, "e2e/home.spec.ts", ruleNames)).toEqual([]);
  });

  test("baseline options are kept", () => {
    const resolved = resolveRules(oxlintConfig, "src/lib/about.ts");
    for (const [ruleName, setting] of Object.entries(baseline.ruleOptions)) {
      expect(resolved[ruleName]).toEqual(setting);
    }
  });

  test("enables every native plugin a baseline rule needs", () => {
    const plugins = new Set<string>(oxlintConfig.plugins);
    const jsPlugins = new Set(
      oxlintConfig.jsPlugins.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name)),
    );
    for (const ruleName of [...baseline.rules, ...baseline.testRules]) {
      const plugin = ruleName.slice(0, ruleName.indexOf("/"));
      expect(plugins.has(plugin) || jsPlugins.has(plugin)).toBe(true);
    }
  });
});

describe("findMissingBaselineRules", () => {
  const config: ResolvableConfig = {
    rules: {
      "typescript/no-explicit-any": "error",
      "jsdoc/empty-tags": ["error", {}],
    },
    overrides: [
      { files: ["**/*.test.ts"], rules: { "jest/no-identical-title": 2 } },
      { files: ["legacy/**"], rules: { "typescript/no-explicit-any": "warn" } },
    ],
  };

  test("accepts a rule set at error, with or without options", () => {
    expect(
      findMissingBaselineRules(config, "a.ts", ["typescript/no-explicit-any", "jsdoc/empty-tags"]),
    ).toEqual([]);
  });

  test("reports a rule the config does not set", () => {
    expect(findMissingBaselineRules(config, "a.ts", ["typescript/return-await"])).toEqual([
      "typescript/return-await",
    ]);
  });

  test("applies overrides only to matching files", () => {
    expect(findMissingBaselineRules(config, "a.test.ts", ["jest/no-identical-title"])).toEqual([]);
    expect(findMissingBaselineRules(config, "a.ts", ["jest/no-identical-title"])).toEqual([
      "jest/no-identical-title",
    ]);
  });

  test("reports a rule an override weakens", () => {
    expect(findMissingBaselineRules(config, "legacy/a.ts", ["typescript/no-explicit-any"])).toEqual(
      ["typescript/no-explicit-any"],
    );
  });

  test("handles a config without rules or overrides", () => {
    expect(findMissingBaselineRules({}, "a.ts", ["eslint/no-unused-vars"])).toEqual([
      "eslint/no-unused-vars",
    ]);
  });
});
