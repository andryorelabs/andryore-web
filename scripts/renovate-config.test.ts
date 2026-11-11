import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

interface PackageRule {
  groupName?: string;
  matchDepTypes?: string[];
  matchUpdateTypes?: string[];
  automerge?: boolean;
}

interface RenovateConfig {
  dependencyDashboard?: boolean;
  labels?: string[];
  packageRules: PackageRule[];
}

const config = Bun.JSON5.parse(
  readFileSync(new URL("../renovate.json5", import.meta.url), "utf8"),
) as RenovateConfig;

describe("renovate.json5", () => {
  test("enables the dependency dashboard and labels", () => {
    expect(config.dependencyDashboard).toBe(true);
    expect(config.labels?.length).toBeGreaterThan(0);
  });

  test("the oxc no-automerge rule comes after the devDependencies automerge rule", () => {
    const rules = config.packageRules;
    const automergeIndex = rules.findIndex(
      (rule) => rule.matchDepTypes?.includes("devDependencies") && rule.automerge === true,
    );
    const oxcIndex = rules.findIndex(
      (rule) => rule.groupName === "oxc" && rule.automerge === false,
    );
    expect(automergeIndex).toBeGreaterThanOrEqual(0);
    expect(oxcIndex).toBeGreaterThan(automergeIndex);
  });
});
