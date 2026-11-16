import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

interface PackageRule {
  groupName?: string;
  matchDepTypes?: string[];
  matchUpdateTypes?: string[];
  automerge?: boolean;
  labels?: string[];
  addLabels?: string[];
}

interface RenovateConfig {
  dependencyDashboard?: boolean;
  labels?: string[];
  vulnerabilityAlerts?: { labels?: string[] };
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

const LABEL_SET = [
  "Type: Bug",
  "Type: Feature",
  "Type: Enhancement",
  "Type: Docs",
  "Type: Security",
  "Status: Needs Info",
  "Status: Needs Decision",
  "Status: Blocked",
  "Status: In Progress",
  "Priority: Critical",
  "Priority: High",
  "Priority: Medium",
  "Priority: Low",
  "Resolution: Duplicate",
  "Resolution: Won't Fix",
  "Resolution: Invalid",
  "dependencies",
  "github-actions",
  "security",
  "breaking-change",
  "good first issue",
  "help wanted",
];

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function labelsInFile(relativePath: string): string[] {
  const names: string[] = [];
  for (const line of readRepositoryFile(relativePath).split("\n")) {
    const match = /^- name: "?(.+?)"?\s*$/.exec(line);
    if (match?.[1] !== undefined) names.push(match[1]);
  }
  return names;
}

function formLabels(): string[] {
  const directory = new URL("../.github/ISSUE_TEMPLATE/", import.meta.url);
  const labels: string[] = [];
  const files = readdirSync(directory).filter((entry) => /\.ya?ml$/.test(entry));
  for (const file of files) {
    const parsed = Bun.YAML.parse(readFileSync(new URL(file, directory), "utf8")) as {
      labels?: string[];
    };
    labels.push(...(parsed.labels ?? []));
  }
  return labels;
}

describe("label set", () => {
  const defined = labelsInFile(".github/labels.yml");
  const definedSet = new Set(defined);

  test("labels.yml holds the standard set plus area labels only", () => {
    const areas = defined.filter((name) => name.startsWith("Area: "));
    expect(areas.length).toBeGreaterThan(0);
    const extra = defined.filter((name) => !LABEL_SET.includes(name) && !areas.includes(name));
    expect(extra).toEqual([]);
    expect(LABEL_SET.filter((name) => !definedSet.has(name))).toEqual([]);
  });

  test("labels.yml has no duplicate names", () => {
    expect(new Set(defined).size).toBe(defined.length);
  });

  test("renovate labels come from labels.yml", () => {
    const used = [
      ...(config.labels ?? []),
      ...(config.vulnerabilityAlerts?.labels ?? []),
      ...config.packageRules.flatMap((rule) => [...(rule.labels ?? []), ...(rule.addLabels ?? [])]),
    ];
    expect(used.filter((name) => !definedSet.has(name))).toEqual([]);
  });

  test("issue forms use labels from labels.yml", () => {
    const used = formLabels();
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !definedSet.has(name))).toEqual([]);
  });
});
