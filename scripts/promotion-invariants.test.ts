import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { listWorkflowFiles, readWorkflow } from "./workflow-files";

const RULESETS_DIRECTORY = path.resolve(import.meta.dirname, "../.github/rulesets");
const SETTINGS_FILE = path.resolve(import.meta.dirname, "repo-settings.json");
const GITHUB_ACTIONS_INTEGRATION_ID = 15_368;
const REQUIRED_CHECKS = ["CI passed", "Validate PR title", "Check markdown links"];
const PROMOTION_SKIP_CONDITION =
  "github.event_name == 'pull_request' && !(github.base_ref == 'main' && github.head_ref == 'develop' && !github.event.pull_request.head.repo.fork)";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readRuleset(file: string): unknown {
  return readJson(path.join(RULESETS_DIRECTORY, file));
}

function findRule(ruleset: unknown, type: string): JsonRecord | undefined {
  return asArray(asRecord(ruleset).rules)
    .filter((rule) => isRecord(rule))
    .find((rule) => rule.type === type);
}

function ruleParameters(ruleset: unknown, type: string): JsonRecord {
  return asRecord(findRule(ruleset, type)?.parameters);
}

function listRequiredStatusChecks(ruleset: unknown): JsonRecord[] {
  return asArray(ruleParameters(ruleset, "required_status_checks").required_status_checks).filter(
    (check) => isRecord(check),
  );
}

function listRequiredCheckNames(ruleset: unknown): string[] {
  return listRequiredStatusChecks(ruleset)
    .map((check) => check.context)
    .filter((context) => typeof context === "string");
}

function includedReferences(ruleset: unknown): unknown {
  return asRecord(asRecord(asRecord(ruleset).conditions).ref_name).include;
}

const developRuleset = readRuleset("develop.json");
const mainRuleset = readRuleset("main.json");

describe("develop ruleset", () => {
  test("is named develop and targets refs/heads/develop", () => {
    expect(asRecord(developRuleset).name).toBe("develop");
    expect(asRecord(developRuleset).target).toBe("branch");
    expect(includedReferences(developRuleset)).toEqual(["refs/heads/develop"]);
  });

  test.each([
    "deletion",
    "non_fast_forward",
    "required_linear_history",
    "required_signatures",
    "pull_request",
    "required_status_checks",
  ])("has the %s rule", (type) => {
    expect(findRule(developRuleset, type)).toBeDefined();
  });

  test("requires a squash-merged pull request with resolved threads", () => {
    const parameters = ruleParameters(developRuleset, "pull_request");

    expect(parameters.allowed_merge_methods).toEqual(["squash"]);
    expect(parameters.required_review_thread_resolution).toBe(true);
  });

  test("requires the three checks, strictly, from GitHub Actions", () => {
    const parameters = ruleParameters(developRuleset, "required_status_checks");

    expect(parameters.strict_required_status_checks_policy).toBe(true);
    expect(listRequiredCheckNames(developRuleset)).toEqual(REQUIRED_CHECKS);
    expect(listRequiredStatusChecks(developRuleset).map((check) => check.integration_id)).toEqual(
      REQUIRED_CHECKS.map(() => GITHUB_ACTIONS_INTEGRATION_ID),
    );
  });
});

describe("main ruleset", () => {
  test("targets the default branch", () => {
    expect(asRecord(mainRuleset).target).toBe("branch");
    expect(includedReferences(mainRuleset)).toEqual(["~DEFAULT_BRANCH"]);
  });

  test.each([
    "deletion",
    "non_fast_forward",
    "required_signatures",
    "pull_request",
    "required_status_checks",
  ])("has the %s rule", (type) => {
    expect(findRule(mainRuleset, type)).toBeDefined();
  });

  test("does not require linear history, so promotions can be merge commits", () => {
    expect(findRule(mainRuleset, "required_linear_history")).toBeUndefined();
  });

  test("allows merge commits only, with resolved threads", () => {
    const parameters = ruleParameters(mainRuleset, "pull_request");

    expect(parameters.allowed_merge_methods).toEqual(["merge"]);
    expect(parameters.required_review_thread_resolution).toBe(true);
  });

  test("requires the three checks, not strictly, from GitHub Actions", () => {
    const parameters = ruleParameters(mainRuleset, "required_status_checks");

    expect(parameters.strict_required_status_checks_policy).toBe(false);
    expect(listRequiredCheckNames(mainRuleset)).toEqual(REQUIRED_CHECKS);
    expect(listRequiredStatusChecks(mainRuleset).map((check) => check.integration_id)).toEqual(
      REQUIRED_CHECKS.map(() => GITHUB_ACTIONS_INTEGRATION_ID),
    );
  });
});

describe("repository settings", () => {
  test("allow merge commits titled and described from the pull request", () => {
    const settings = asRecord(asRecord(readJson(SETTINGS_FILE)).settings);

    expect(settings.allowMergeCommit).toBe(true);
    expect(settings.mergeCommitTitle).toBe("PR_TITLE");
    expect(settings.mergeCommitMessage).toBe("PR_BODY");
  });
});

describe("commitlint job", () => {
  test("skips the develop to main promotion pull request", () => {
    const conditions = listWorkflowFiles()
      .map((file) => readWorkflow(file).jobs?.commitlint?.if)
      .filter((condition) => condition !== undefined);

    expect(conditions).toEqual([PROMOTION_SKIP_CONDITION]);
  });
});

describe("CI passed job", () => {
  const aggregate = readWorkflow("ci.yml").jobs?.["ci-passed"];

  test("always runs and waits for commitlint", () => {
    expect(aggregate?.name).toBe("CI passed");
    expect(aggregate?.if).toBe("always()");
    expect(asArray(aggregate?.needs)).toContain("commitlint");
  });

  test("fails only on a failed or cancelled job, so a skipped commitlint passes", () => {
    const failedExpressions = (aggregate?.steps ?? [])
      .map((step) => step.env?.FAILED)
      .filter((expression) => typeof expression === "string")
      .map((expression) => expression.replaceAll(/\s+/g, " "));

    expect(failedExpressions).toEqual([
      "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}",
    ]);
  });
});
