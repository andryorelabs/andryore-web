import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  listWorkflowFiles,
  parseWorkflow,
  readWorkflow,
  readWorkflowText,
  type Workflow,
  type WorkflowStep,
} from "./workflow-files";

const FULL_SHA_PATTERN = /^[\da-f]{40}$/;

/**
 * Collects every `uses:` reference of a workflow, job-level and step-level.
 * @param workflow The parsed workflow.
 * @returns The raw `uses:` values.
 */
function collectUses(workflow: Workflow): string[] {
  const jobs = Object.values(workflow.jobs ?? {});
  const jobUses = jobs.flatMap((job) => job.uses ?? []);
  const stepUses = jobs.flatMap((job) => (job.steps ?? []).flatMap((step) => step.uses ?? []));
  return [...jobUses, ...stepUses];
}

/**
 * Finds `uses:` references that are not pinned to a 40-character SHA.
 * Local actions (`./...`) are exempt.
 * @param workflow The parsed workflow.
 * @returns The offending `uses:` values.
 */
function findUnpinnedUses(workflow: Workflow): string[] {
  return collectUses(workflow).filter((reference) => {
    if (reference.startsWith("./")) return false;
    const revision = reference.split("@", 2)[1] ?? "";
    return !FULL_SHA_PATTERN.test(revision);
  });
}

/**
 * Whether a workflow declares explicit `permissions` at the top level or on
 * every job.
 * @param workflow The parsed workflow.
 * @returns True when permissions are explicit everywhere they apply.
 */
function hasExplicitPermissions(workflow: Workflow): boolean {
  if (workflow.permissions !== undefined) return true;
  const jobs = Object.values(workflow.jobs ?? {});
  return jobs.length > 0 && jobs.every((job) => job.permissions !== undefined);
}

/**
 * Collects every step of a workflow.
 * @param workflow The parsed workflow.
 * @returns The steps of all jobs.
 */
function collectSteps(workflow: Workflow): WorkflowStep[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

/**
 * Lists the event names a workflow triggers on.
 * @param workflow The parsed workflow.
 * @returns The names of the events that start the workflow.
 */
function triggerNames(workflow: Workflow): string[] {
  const trigger = workflow.on;
  if (typeof trigger === "string") return [trigger];
  if (Array.isArray(trigger)) return trigger.map(String);
  return trigger !== null && typeof trigger === "object" ? Object.keys(trigger) : [];
}

/**
 * Finds jobs that do not declare a numeric `timeout-minutes`.
 * @param workflow The parsed workflow.
 * @returns The offending job names.
 */
function findJobsWithoutTimeout(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs ?? {})
    .filter(([, job]) => typeof job["timeout-minutes"] !== "number")
    .map(([jobName]) => jobName);
}

/**
 * Finds jobs whose `actions/checkout` keeps the token in the git config. A job
 * that pushes may opt in with an explicit `persist-credentials: true` only
 * when it also holds `contents: write`.
 * @param workflow The parsed workflow.
 * @returns The offending job names.
 */
function findCheckoutsPersistingCredentials(workflow: Workflow): string[] {
  return Object.entries(workflow.jobs ?? {})
    .filter(([, job]) => {
      const permissions = job.permissions as Record<string, unknown> | undefined;
      const isMayPush = permissions?.contents === "write";
      return (job.steps ?? []).some((step) => {
        if (!step.uses?.startsWith("actions/checkout@")) return false;
        const persist = step.with?.["persist-credentials"];
        return !(persist === false || (persist === true && isMayPush));
      });
    })
    .map(([jobName]) => jobName);
}

/**
 * Finds `run:` scripts that interpolate a `${{ }}` expression.
 * @param workflow The parsed workflow.
 * @returns The offending scripts.
 */
function findExpressionsInRun(workflow: Workflow): string[] {
  return collectSteps(workflow)
    .map((step) => step.run ?? "")
    .filter((script) => script.includes("${{"));
}

/**
 * Whether the top-level permissions are `contents: read` or stricter.
 * @param workflow The parsed workflow.
 * @returns True for `{}` or exactly `{ contents: read }`.
 */
function hasReadOnlyTopLevelPermissions(workflow: Workflow): boolean {
  const permissions = workflow.permissions;
  if (permissions === null || typeof permissions !== "object") return false;
  const entries = Object.entries(permissions);
  return (
    entries.length === 0 ||
    (entries.length === 1 && entries[0]?.[0] === "contents" && entries[0][1] === "read")
  );
}

/**
 * Finds the release gate step that requires a green `CI passed` check run.
 * @param workflow The parsed release workflow.
 * @returns The gate step, when present.
 */
function findReleaseGate(workflow: Workflow): WorkflowStep | undefined {
  return collectSteps(workflow).find(
    (step) =>
      step.name === "Require green CI on the tagged commit" &&
      (step.run ?? "").includes('"CI passed"') &&
      (step.run ?? "").includes("check-runs") &&
      (step.run ?? "").includes('"success"'),
  );
}

const RELEASE_KEPT_FRAGMENTS = [
  "merge-base --is-ancestor",
  "release-notes.md",
  "gh release view",
  "gh release create",
  "--prerelease --latest=false",
] as const;

/**
 * Finds release behaviour that the release script no longer contains.
 * @param workflow The parsed release workflow.
 * @returns The missing script fragments.
 */
function findMissingReleaseBehaviour(workflow: Workflow): string[] {
  const script = collectSteps(workflow)
    .map((step) => step.run ?? "")
    .join("\n");
  return RELEASE_KEPT_FRAGMENTS.filter((fragment) => !script.includes(fragment));
}

/**
 * Whether the ESLint cache step keys on the local ESLint rules.
 * @param workflow The parsed CI workflow.
 * @returns True when the cache key hashes `eslint-rules/**`.
 */
function hasEslintCacheKeyOnLocalRules(workflow: Workflow): boolean {
  const cacheStep = collectSteps(workflow).find(
    (step) => typeof step.with?.path === "string" && step.with.path.includes(".eslintcache"),
  );
  const key = cacheStep?.with?.key;
  return typeof key === "string" && key.includes("eslint-rules/**");
}

/**
 * Lists the job `name:` values of a workflow.
 * @param workflow The parsed workflow.
 * @returns The display names of the jobs.
 */
function collectJobNames(workflow: Workflow): string[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.name ?? []);
}

/**
 * Finds required status check contexts that no job name provides.
 * @param rulesetText The ruleset JSON text.
 * @param jobNames Every job name across the workflows.
 * @returns The contexts without a matching job.
 */
function findUnmatchedRequiredContexts(rulesetText: string, jobNames: readonly string[]): string[] {
  const ruleset = JSON.parse(rulesetText) as {
    rules: {
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }[];
  };
  return ruleset.rules
    .filter((rule) => rule.type === "required_status_checks")
    .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
    .map((check) => check.context)
    .filter((context) => !jobNames.includes(context));
}

/**
 * The light jobs that may move to the runner in `vars.BLACKSMITH_RUNNER`, as
 * `<file>:<job>` ([ADR 0024](../docs/adr/0024-ci-runner-standard-and-sharded-site-quality.md)).
 */
const ROUTED_JOBS = [
  "ci.yml:quality",
  "ci.yml:test",
  "ci.yml:commitlint",
  "ci.yml:ci-passed",
  "lint-pr.yml:validate-title",
  "lint-docs.yml:check-links",
  "labels.yml:sync",
  "lint-workflows.yml:lint",
] as const;

const ROUTED_RUNNER =
  "${{ github.event.pull_request.head.repo.fork && 'ubuntu-latest' || vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}";
const DEFAULT_RUNNER = "ubuntu-latest";
const SELF_HOSTED_RUNNER_PATTERN = /vps-|self-hosted/;

/**
 * The job fields the runner and matrix checks read.
 */
interface RunnerJob {
  readonly "runs-on"?: unknown;
  readonly strategy?: {
    readonly "fail-fast"?: unknown;
    readonly matrix?: Record<string, unknown>;
  };
}

/**
 * Lists every job of a workflow as a `<file>:<job>` key with its job.
 * @param fileName The workflow file name.
 * @param workflow The parsed workflow.
 * @returns Pairs of `<file>:<job>` and the job it names.
 */
function keyedJobs(fileName: string, workflow: Workflow): [string, RunnerJob][] {
  return Object.entries(workflow.jobs ?? {}).map(([jobName, job]) => [
    `${fileName}:${jobName}`,
    job as RunnerJob,
  ]);
}

/**
 * Finds jobs whose `runs-on` breaks the routing: a routed job must use exactly
 * the routed expression, every other job a literal `ubuntu-latest`.
 * @param fileName The workflow file name.
 * @param workflow The parsed workflow.
 * @param routedJobs The `<file>:<job>` keys that are routed.
 * @returns The offending `<file>:<job>` keys.
 */
function findRoutingViolations(
  fileName: string,
  workflow: Workflow,
  routedJobs: readonly string[],
): string[] {
  return keyedJobs(fileName, workflow)
    .filter(([key, job]) => {
      const expected = routedJobs.includes(key) ? ROUTED_RUNNER : DEFAULT_RUNNER;
      return job["runs-on"] !== expected;
    })
    .map(([key]) => key);
}

/**
 * Finds jobs outside the routed list that read `vars.BLACKSMITH_RUNNER`
 * anywhere.
 * @param fileName The workflow file name.
 * @param workflow The parsed workflow.
 * @param routedJobs The `<file>:<job>` keys that are routed.
 * @returns The offending `<file>:<job>` keys.
 */
function findUnroutedRunnerReaders(
  fileName: string,
  workflow: Workflow,
  routedJobs: readonly string[],
): string[] {
  return keyedJobs(fileName, workflow)
    .filter(
      ([key, job]) =>
        !routedJobs.includes(key) && JSON.stringify(job).includes("vars.BLACKSMITH_RUNNER"),
    )
    .map(([key]) => key);
}

/**
 * Finds jobs whose `runs-on` names a VPS or a self-hosted runner.
 * @param fileName The workflow file name.
 * @param workflow The parsed workflow.
 * @returns The offending `<file>:<job>` keys.
 */
function findSelfHostedRunners(fileName: string, workflow: Workflow): string[] {
  return keyedJobs(fileName, workflow)
    .filter(([, job]) => SELF_HOSTED_RUNNER_PATTERN.test(JSON.stringify(job["runs-on"] ?? "")))
    .map(([key]) => key);
}

const PINNED_SHA = "a".repeat(40);

describe("invariant detectors", () => {
  test("flags a tag-pinned action", () => {
    const workflow = parseWorkflow(`
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`);
    expect(findUnpinnedUses(workflow)).toEqual(["actions/checkout@v4"]);
  });

  test("flags a branch-pinned reusable workflow and a short SHA", () => {
    const workflow = parseWorkflow(`
on: push
jobs:
  reuse:
    uses: owner/repo/workflows/x.yml@main
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@abc1234
`);
    expect(findUnpinnedUses(workflow)).toEqual([
      "owner/repo/workflows/x.yml@main",
      "actions/checkout@abc1234",
    ]);
  });

  test("accepts a SHA-pinned action and a local action", () => {
    const workflow = parseWorkflow(`
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${PINNED_SHA} # v4
      - uses: ./local-action
`);
    expect(findUnpinnedUses(workflow)).toEqual([]);
  });

  test("flags a workflow without permissions", () => {
    const workflow = parseWorkflow(`
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`);
    expect(hasExplicitPermissions(workflow)).toBe(false);
  });

  test("accepts top-level permissions and per-job permissions", () => {
    const topLevel = parseWorkflow(`
on: push
permissions: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`);
    const perJob = parseWorkflow(`
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - run: echo hi
`);
    expect(hasExplicitPermissions(topLevel)).toBe(true);
    expect(hasExplicitPermissions(perJob)).toBe(true);
  });

  test("flags per-job permissions that miss a job", () => {
    const workflow = parseWorkflow(`
on: push
jobs:
  first:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - run: echo hi
  second:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`);
    expect(hasExplicitPermissions(workflow)).toBe(false);
  });
});

const JOB_HEADER = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
`;
const CHECKOUT = `actions/checkout@${PINNED_SHA}`;

describe("hardening detectors", () => {
  test("flags a job without timeout-minutes", () => {
    const bad = parseWorkflow(`${JOB_HEADER}    steps:
      - run: echo hi
`);
    const good = parseWorkflow(`${JOB_HEADER}    timeout-minutes: 5
    steps:
      - run: echo hi
`);
    expect(findJobsWithoutTimeout(bad)).toEqual(["build"]);
    expect(findJobsWithoutTimeout(good)).toEqual([]);
  });

  test("flags a checkout that keeps credentials", () => {
    const missing = parseWorkflow(`${JOB_HEADER}    steps:
      - uses: ${CHECKOUT}
`);
    const disabled = parseWorkflow(`${JOB_HEADER}    steps:
      - uses: ${CHECKOUT}
        with:
          persist-credentials: false
`);
    expect(findCheckoutsPersistingCredentials(missing)).toEqual(["build"]);
    expect(findCheckoutsPersistingCredentials(disabled)).toEqual([]);
  });

  test("allows explicit persist-credentials only for a pushing job", () => {
    const steps = `    steps:
      - uses: ${CHECKOUT}
        with:
          persist-credentials: true
`;
    const pushing = parseWorkflow(`${JOB_HEADER}    permissions:
      contents: write
${steps}`);
    const readOnly = parseWorkflow(`${JOB_HEADER}    permissions:
      contents: read
${steps}`);
    expect(findCheckoutsPersistingCredentials(pushing)).toEqual([]);
    expect(findCheckoutsPersistingCredentials(readOnly)).toEqual(["build"]);
  });

  test("flags the pull_request_target trigger", () => {
    const bad = parseWorkflow("on:\n  pull_request_target:\njobs: {}\n");
    const list = parseWorkflow("on: [push, pull_request_target]\njobs: {}\n");
    const good = parseWorkflow("on:\n  pull_request:\njobs: {}\n");
    expect(triggerNames(bad)).toContain("pull_request_target");
    expect(triggerNames(list)).toContain("pull_request_target");
    expect(triggerNames(good)).not.toContain("pull_request_target");
  });

  test("flags an expression inside run", () => {
    const bad = parseWorkflow(`${JOB_HEADER}    steps:
      - run: echo \${{ github.actor }}
`);
    const good = parseWorkflow(`${JOB_HEADER}    steps:
      - env:
          ACTOR: \${{ github.actor }}
        run: echo "$ACTOR"
`);
    expect(findExpressionsInRun(bad)).toHaveLength(1);
    expect(findExpressionsInRun(good)).toEqual([]);
  });

  test("accepts only contents: read or stricter at the top level", () => {
    const withPermissions = (permissions: string) =>
      parseWorkflow(`on: push\npermissions: ${permissions}\njobs: {}\n`);
    expect(hasReadOnlyTopLevelPermissions(withPermissions("{}"))).toBe(true);
    expect(hasReadOnlyTopLevelPermissions(withPermissions("{ contents: read }"))).toBe(true);
    expect(hasReadOnlyTopLevelPermissions(withPermissions("{ contents: write }"))).toBe(false);
    expect(hasReadOnlyTopLevelPermissions(withPermissions("write-all"))).toBe(false);
    expect(
      hasReadOnlyTopLevelPermissions(withPermissions("{ contents: read, issues: write }")),
    ).toBe(false);
    expect(hasReadOnlyTopLevelPermissions(parseWorkflow("on: push\njobs: {}\n"))).toBe(false);
  });
});

/**
 * Builds a release workflow whose only step runs the given script.
 * @param run The script body.
 * @returns The parsed workflow.
 */
function releaseWithRun(run: string): Workflow {
  return { jobs: { release: { steps: [{ run }] } } };
}

/**
 * Builds a CI workflow with an ESLint cache step using the given key.
 * @param key The cache key expression.
 * @returns The parsed workflow.
 */
function ciWithCacheKey(key: string): Workflow {
  return parseWorkflow(
    `on: push\njobs:\n  quality:\n    steps:\n      - uses: a/b@${PINNED_SHA}\n        with:\n          path: .eslintcache\n          key: ${key}\n`,
  );
}

describe("release and ci detectors", () => {
  const gate = `
on: push
jobs:
  release:
    steps:
      - name: Require green CI on the tagged commit
        run: gh api repos/x/commits/y/check-runs | grep "CI passed" "success"
`;

  test("flags a release without the green-CI gate", () => {
    expect(findReleaseGate(parseWorkflow(gate))).toBeDefined();
    expect(
      findReleaseGate(
        parseWorkflow("on: push\njobs:\n  release:\n    steps:\n      - run: echo hi\n"),
      ),
    ).toBeUndefined();
  });

  test("flags a release that dropped a kept behaviour", () => {
    const complete = RELEASE_KEPT_FRAGMENTS.join("\n");
    expect(findMissingReleaseBehaviour(releaseWithRun(complete))).toEqual([]);
    const withoutFlags = complete.replace("--prerelease --latest=false", "");
    expect(findMissingReleaseBehaviour(releaseWithRun(withoutFlags))).toEqual([
      "--prerelease --latest=false",
    ]);
    expect(findMissingReleaseBehaviour(releaseWithRun(""))).toHaveLength(
      RELEASE_KEPT_FRAGMENTS.length,
    );
  });

  test("flags an eslint cache key without the local rules", () => {
    expect(hasEslintCacheKeyOnLocalRules(ciWithCacheKey("${{ hashFiles('bun.lock') }}"))).toBe(
      false,
    );
    expect(
      hasEslintCacheKeyOnLocalRules(ciWithCacheKey("${{ hashFiles('eslint-rules/**') }}")),
    ).toBe(true);
  });

  test("flags a required context that no job name provides", () => {
    const ruleset = JSON.stringify({
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: "A" }, { context: "B" }],
          },
        },
        { type: "deletion" },
      ],
    });
    expect(findUnmatchedRequiredContexts(ruleset, ["A", "B"])).toEqual([]);
    expect(findUnmatchedRequiredContexts(ruleset, ["A"])).toEqual(["B"]);
  });
});

/**
 * Builds a one-job workflow with the given `runs-on` value.
 * @param runsOn The raw YAML for `runs-on`.
 * @param extra Extra raw YAML lines for the job.
 * @returns The parsed workflow.
 */
function workflowRunningOn(runsOn: string, extra = ""): Workflow {
  return parseWorkflow(
    `on: push\njobs:\n  build:\n    runs-on: ${runsOn}\n    timeout-minutes: 5\n${extra}`,
  );
}

describe("runner routing detectors", () => {
  const routed = ["x.yml:build"];

  test("accepts the routed expression on a routed job", () => {
    const workflow = workflowRunningOn(`"${ROUTED_RUNNER}"`);
    expect(findRoutingViolations("x.yml", workflow, routed)).toEqual([]);
    expect(findUnroutedRunnerReaders("x.yml", workflow, routed)).toEqual([]);
  });

  test("flags a routed job on a literal runner or a looser expression", () => {
    const literal = workflowRunningOn("ubuntu-latest");
    const withoutForkGuard = workflowRunningOn(
      "\"${{ vars.BLACKSMITH_RUNNER || 'ubuntu-latest' }}\"",
    );
    expect(findRoutingViolations("x.yml", literal, routed)).toEqual(["x.yml:build"]);
    expect(findRoutingViolations("x.yml", withoutForkGuard, routed)).toEqual(["x.yml:build"]);
  });

  test("flags an unrouted job that is not on a literal ubuntu-latest", () => {
    const expression = workflowRunningOn(`"${ROUTED_RUNNER}"`);
    const otherImage = workflowRunningOn("ubuntu-24.04");
    expect(findRoutingViolations("x.yml", expression, [])).toEqual(["x.yml:build"]);
    expect(findRoutingViolations("x.yml", otherImage, [])).toEqual(["x.yml:build"]);
    expect(findRoutingViolations("x.yml", workflowRunningOn("ubuntu-latest"), [])).toEqual([]);
  });

  test("flags an unrouted job that reads the variable anywhere", () => {
    const readsInEnvironment = workflowRunningOn(
      "ubuntu-latest",
      "    env:\n      RUNNER: ${{ vars.BLACKSMITH_RUNNER }}\n",
    );
    expect(findUnroutedRunnerReaders("x.yml", readsInEnvironment, [])).toEqual(["x.yml:build"]);
    expect(findUnroutedRunnerReaders("x.yml", readsInEnvironment, routed)).toEqual([]);
  });

  test("flags a VPS or self-hosted runner", () => {
    expect(findSelfHostedRunners("x.yml", workflowRunningOn("[self-hosted, linux]"))).toEqual([
      "x.yml:build",
    ]);
    expect(findSelfHostedRunners("x.yml", workflowRunningOn("vps-netcup"))).toEqual([
      "x.yml:build",
    ]);
    expect(findSelfHostedRunners("x.yml", workflowRunningOn("ubuntu-latest"))).toEqual([]);
  });
});

describe("runner routing", () => {
  const allJobKeys = new Set(
    listWorkflowFiles().flatMap((fileName) =>
      keyedJobs(fileName, readWorkflow(fileName)).map(([key]) => key),
    ),
  );

  test("every routed job exists", () => {
    expect(ROUTED_JOBS.filter((key) => !allJobKeys.has(key))).toEqual([]);
  });

  test.each(listWorkflowFiles())(
    "%s routes only the listed jobs, with the exact expression",
    (fileName) => {
      const workflow = readWorkflow(fileName);
      expect(findRoutingViolations(fileName, workflow, ROUTED_JOBS)).toEqual([]);
      expect(findUnroutedRunnerReaders(fileName, workflow, ROUTED_JOBS)).toEqual([]);
      expect(findSelfHostedRunners(fileName, workflow)).toEqual([]);
    },
  );
});

describe("site-quality.yml sharding", () => {
  const jobs = readWorkflow("site-quality.yml").jobs ?? {};

  test("runs e2e as four shards that do not cancel each other", () => {
    const strategy = (jobs.e2e as RunnerJob | undefined)?.strategy;
    expect(strategy?.["fail-fast"]).toBe(false);
    expect(strategy?.matrix?.shard).toEqual([1, 2, 3, 4]);
    expect(jobs.e2e?.name).toBe("Accessibility and layout (Playwright)");
  });

  test("passes the shard through env and uploads a report per shard", () => {
    const steps = jobs.e2e?.steps ?? [];
    const runStep = steps.find((step) => step.name === "Run e2e");
    expect(runStep?.env?.SHARD).toBe("${{ matrix.shard }}/4");
    expect(runStep?.run).toContain('--shard="$SHARD"');
    const upload = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.with?.name).toBe("e2e-report-${{ matrix.shard }}");
  });

  test("splits the snapshots and the WebKit and Firefox specs into two jobs", () => {
    const runs = (jobName: string) => (jobs[jobName]?.steps ?? []).map((step) => step.run);
    expect(runs("visual")).toContain("bun run test:visual");
    expect(runs("visual")).not.toContain("bun run test:browsers");
    expect(runs("browsers")).toContain("bun run test:browsers");
    expect(runs("browsers")).not.toContain("bun run test:visual");
    expect(jobs.browsers?.if).toBeDefined();
    expect(jobs.browsers?.if).toBe(jobs.visual?.if);
    expect(jobs.browsers?.needs).toBe("build");
  });

  test("builds the Site in exactly one job, which uploads dist as site-dist", () => {
    const buildingJobs = Object.entries(jobs)
      .filter(([, job]) => (job.steps ?? []).some((step) => step.run === "bun run build"))
      .map(([jobName]) => jobName);
    expect(buildingJobs).toEqual(["build"]);
    const upload = (jobs.build?.steps ?? []).find((step) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    expect(upload?.with?.name).toBe("site-dist");
    expect(upload?.with?.path).toBe("dist");
    expect(upload?.with?.["include-hidden-files"]).toBe(true);
    expect(upload?.if).toBeUndefined();
  });

  test.each(["e2e", "visual", "browsers"])(
    "%s needs build and downloads site-dist into dist",
    (jobName) => {
      const job = jobs[jobName];
      expect(job?.needs).toBe("build");
      const download = (job?.steps ?? []).find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      );
      expect(download?.with?.name).toBe("site-dist");
      expect(download?.with?.path).toBe("dist");
    },
  );

  test("smoke and csp keep their own Docker builds and do not need build", () => {
    expect(jobs.smoke?.needs).toBeUndefined();
    expect(jobs.csp?.needs).toBeUndefined();
  });

  test("runs nightly on a schedule as well as on pull requests", () => {
    const workflow = readWorkflow("site-quality.yml");
    const triggers = triggerNames(workflow);
    expect(triggers).toContain("pull_request");
    expect(triggers).toContain("workflow_dispatch");
    expect(triggers).toContain("schedule");
    const schedule = (workflow.on as { schedule?: { cron?: string }[] }).schedule;
    expect(schedule?.length).toBe(1);
    expect(schedule?.[0]?.cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  test("the Playwright config runs tests within a file in parallel", () => {
    const config = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");
    expect(config).toMatch(/^\s*fullyParallel: true,$/m);
  });
});

describe("release.yml gates", () => {
  const release = readWorkflow("release.yml");

  test("requires a green CI passed check run before the Release", () => {
    expect(findReleaseGate(release)).toBeDefined();
    const names = collectSteps(release).map((step) => step.name);
    expect(names.indexOf("Require green CI on the tagged commit")).toBeLessThan(
      names.indexOf("Create GitHub Release"),
    );
  });

  test("keeps main ancestry, notes, idempotent create and prerelease flags", () => {
    expect(findMissingReleaseBehaviour(release)).toEqual([]);
  });
});

describe("ci.yml gates", () => {
  const ci = readWorkflow("ci.yml");

  test("keys the eslint cache on eslint-rules/**", () => {
    expect(hasEslintCacheKeyOnLocalRules(ci)).toBe(true);
  });

  test("commitlint clones the full history blobless", () => {
    const checkout = (ci.jobs?.commitlint?.steps ?? []).find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    expect(checkout?.with?.filter).toBe("blob:none");
  });

  test("the CI passed aggregate needs the build job", () => {
    expect(ci.jobs?.["ci-passed"]?.needs).toContain("build");
    expect(ci.jobs?.build?.name).toBe("Build");
  });

  test("the quality job gates on bun run check alone, with no separate lint step", () => {
    const steps = ci.jobs?.quality?.steps ?? [];
    const runs = steps.map((step) => step.run);
    expect(runs).toContain("bun run check");
    expect(runs).not.toContain("bun run lint:oxlint");
    expect(steps.some((step) => step["continue-on-error"] !== undefined)).toBe(false);
  });
});

test.each(["main", "develop"])(
  "every required %s ruleset context matches a workflow job name",
  (branch) => {
    const rulesetText = readFileSync(
      new URL(`../.github/rulesets/${branch}.json`, import.meta.url),
      "utf8",
    );
    const jobNames = listWorkflowFiles().flatMap((fileName) =>
      collectJobNames(parseWorkflow(readWorkflowText(fileName))),
    );
    expect(findUnmatchedRequiredContexts(rulesetText, jobNames)).toEqual([]);
  },
);

test("there is at least one workflow to check", () => {
  expect(listWorkflowFiles().length).toBeGreaterThan(0);
});

describe.each(listWorkflowFiles())("%s", (fileName) => {
  const workflow = readWorkflow(fileName);

  test("every uses: is pinned to a 40-character SHA", () => {
    expect(findUnpinnedUses(workflow)).toEqual([]);
  });

  test("declares explicit permissions", () => {
    expect(hasExplicitPermissions(workflow)).toBe(true);
  });

  test("every job declares timeout-minutes", () => {
    expect(findJobsWithoutTimeout(workflow)).toEqual([]);
  });

  test("every checkout sets persist-credentials: false", () => {
    expect(findCheckoutsPersistingCredentials(workflow)).toEqual([]);
  });

  test("does not use pull_request_target", () => {
    expect(triggerNames(workflow)).not.toContain("pull_request_target");
  });

  test("no run script interpolates an expression", () => {
    expect(findExpressionsInRun(workflow)).toEqual([]);
  });

  test("top-level permissions are contents: read or stricter", () => {
    expect(hasReadOnlyTopLevelPermissions(workflow)).toBe(true);
  });
});

const ZERO_SHA = "0".repeat(40);
const SOME_SHA = "a".repeat(40);

/**
 * Runs `.husky/pre-push` with a stub `bun` first on `PATH`, so the hook's
 * typecheck is observable without running tsc.
 * @param pushLines The ref lines git writes to the hook's stdin.
 * @param typecheckExitCode The exit code the stub returns for the typecheck.
 * @returns The hook's exit code and the commands the stub received.
 */
function runPrePush(
  pushLines: string[],
  typecheckExitCode: number,
): { status: number | null; bunCalls: string[] } {
  const stubDirectory = mkdtempSync(path.join(tmpdir(), "pre-push-"));
  const callLog = path.join(stubDirectory, "calls.log");
  try {
    const stub = path.join(stubDirectory, "bun");
    writeFileSync(
      stub,
      `#!/bin/sh\necho "$*" >> "${callLog}"\nexit ${String(typecheckExitCode)}\n`,
    );
    chmodSync(stub, 0o755);
    writeFileSync(callLog, "");
    const result = spawnSync("sh", [new URL("../.husky/pre-push", import.meta.url).pathname], {
      input: pushLines.map((line) => `${line}\n`).join(""),
      env: {
        ...process.env,
        PATH: `${stubDirectory}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });
    const bunCalls = readFileSync(callLog, "utf8").split("\n").filter(Boolean);
    return { status: result.status, bunCalls };
  } finally {
    rmSync(stubDirectory, { recursive: true, force: true });
  }
}

describe(".husky/pre-push", () => {
  const branchPush = `refs/heads/feat/x ${SOME_SHA} refs/heads/feat/x ${ZERO_SHA}`;

  test("typechecks once and allows a clean tree", () => {
    const result = runPrePush([branchPush, branchPush], 0);
    expect(result.status).toBe(0);
    expect(result.bunCalls).toEqual(["run typecheck"]);
  });

  test("rejects the push when the typecheck fails", () => {
    expect(runPrePush([branchPush], 2).status).not.toBe(0);
  });

  test("rejects an invalid branch name before typechecking", () => {
    const result = runPrePush([`refs/heads/bad ${SOME_SHA} refs/heads/bad ${ZERO_SHA}`], 0);
    expect(result.status).toBe(1);
    expect(result.bunCalls).toEqual([]);
  });

  test("skips the typecheck for a deletion-only push", () => {
    const result = runPrePush([`(delete) ${ZERO_SHA} refs/heads/feat/x ${SOME_SHA}`], 2);
    expect(result.status).toBe(0);
    expect(result.bunCalls).toEqual([]);
  });

  test("skips the typecheck for a tag-only push", () => {
    const result = runPrePush([`refs/tags/v1.0.0 ${SOME_SHA} refs/tags/v1.0.0 ${ZERO_SHA}`], 2);
    expect(result.status).toBe(0);
    expect(result.bunCalls).toEqual([]);
  });
});
