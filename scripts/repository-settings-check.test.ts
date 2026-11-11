import { describe, expect, spyOn, test } from "bun:test";

import {
  compareRepositorySettings,
  fetchLiveRepositorySettings,
  formatDifferences,
  loadExpectedRepositorySettings,
  RepositorySettingsError,
  runRepositorySettingsCheck,
  type GhRunner,
  type RepositorySettings,
} from "./repository-settings-check.ts";

const { repository, expected } = loadExpectedRepositorySettings();

function cloneSettings(): RepositorySettings {
  return structuredClone(expected);
}

describe("loadExpectedRepositorySettings", () => {
  test("reads the settings file and every ruleset", () => {
    expect(repository).toBe("andryorelabs/andryore-web");
    expect(expected.settings.squashMergeCommitTitle).toBe("PR_TITLE");
    expect(
      Object.keys(expected.rulesets).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(["develop", "main", "tags"]);
  });
});

describe("compareRepositorySettings", () => {
  test("reports nothing when live equals expected", () => {
    expect(compareRepositorySettings(expected, cloneSettings())).toEqual([]);
  });

  test("reports a changed setting", () => {
    const live = cloneSettings();
    live.settings.allowMergeCommit = true;
    expect(compareRepositorySettings(expected, live)).toEqual([
      {
        setting: "settings.allowMergeCommit",
        expected: "false",
        actual: "true",
      },
    ]);
  });

  test("reports missing and extra topics", () => {
    const live = cloneSettings();
    live.topics = ["astro", "extra"];
    const settings = compareRepositorySettings(expected, live).map(
      (difference) => difference.setting,
    );
    expect(settings).toContain("topics.react");
    expect(settings).toContain("topics.extra");
  });

  test("reports a rule the live ruleset lacks", () => {
    const live = cloneSettings();
    const develop = live.rulesets.develop as { rules: { type: string }[] };
    develop.rules = develop.rules.filter((rule) => rule.type !== "required_signatures");
    expect(compareRepositorySettings(expected, live)).toEqual([
      {
        setting: "ruleset develop.rules.required_signatures",
        expected: "present",
        actual: "(missing)",
      },
    ]);
  });

  test("reports a differing rule parameter and ignores live extras", () => {
    const live = cloneSettings();
    const develop = live.rulesets.develop as {
      id: number;
      rules: { type: string; parameters?: Record<string, unknown> }[];
    };
    develop.id = 7;
    const pullRequest = develop.rules.find((rule) => rule.type === "pull_request");
    if (pullRequest?.parameters === undefined) throw new Error("fixture lost its parameters");
    pullRequest.parameters.required_approving_review_count = 1;
    pullRequest.parameters.extra = true;
    expect(compareRepositorySettings(expected, live)).toEqual([
      {
        setting: "ruleset develop.rules.pull_request.parameters.required_approving_review_count",
        expected: "0",
        actual: "1",
      },
    ]);
  });

  test("reports a missing ruleset and a live rule the file lacks", () => {
    const live = cloneSettings();
    delete live.rulesets.tags;
    const main = live.rulesets.main as { rules: { type: string }[] };
    main.rules.push({ type: "creation" });
    const settings = compareRepositorySettings(expected, live).map(
      (difference) => difference.setting,
    );
    expect(settings).toContain("ruleset tags");
    expect(settings).toContain("ruleset main.rules.creation");
  });
});

describe("formatDifferences", () => {
  test("prints one line per difference", () => {
    expect(
      formatDifferences([
        { setting: "a", expected: "1", actual: "2" },
        { setting: "b", expected: "x", actual: "y" },
      ]),
    ).toBe("a: expected 1, got 2\nb: expected x, got y");
  });
});

function fakeGh(routes: Record<string, unknown>): GhRunner {
  return ([, endpoint = ""]) => {
    const body = routes[endpoint];
    return body === undefined
      ? { status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)" }
      : { status: 0, stdout: JSON.stringify(body), stderr: "" };
  };
}

const unauthenticatedGh: GhRunner = () => ({
  status: 4,
  stdout: "",
  stderr: "To get started with GitHub CLI, please run:  gh auth login",
});

const failingGh: GhRunner = () => ({ status: 1, stdout: "", stderr: "boom" });

const emptyGh: GhRunner = () => ({ status: 0, stdout: "", stderr: "" });

describe("fetchLiveRepositorySettings", () => {
  test("maps the GitHub payloads onto the settings shape", () => {
    const live = fetchLiveRepositorySettings(
      "o/r",
      fakeGh({
        "repos/o/r": {
          allow_squash_merge: true,
          allow_merge_commit: false,
          homepage: "https://andryore.dev",
          topics: ["astro"],
          security_and_analysis: { secret_scanning: { status: "enabled" } },
        },
        "repos/o/r/private-vulnerability-reporting": { enabled: true },
        "repos/o/r/rulesets": [{ id: 3, name: "develop" }],
        "repos/o/r/rulesets/3": { name: "develop", rules: [] },
      }),
    );
    expect(live.settings.allowSquashMerge).toBe(true);
    expect(live.settings.secretScanning).toBe("enabled");
    expect(live.settings.privateVulnerabilityReporting).toBe(true);
    expect(live.settings.secretScanningPushProtection).toBeUndefined();
    expect(live.topics).toEqual(["astro"]);
    expect(live.rulesets.develop).toEqual({ name: "develop", rules: [] });
  });

  test("fails clearly when gh is unauthenticated", () => {
    expect(() => fetchLiveRepositorySettings("o/r", unauthenticatedGh)).toThrow(/gh auth login/);
  });

  test("fails clearly on a 404", () => {
    expect(() => fetchLiveRepositorySettings("o/r", fakeGh({}))).toThrow(RepositorySettingsError);
    expect(() => fetchLiveRepositorySettings("o/r", fakeGh({}))).toThrow(/404/);
  });

  test("fails with the gh message on another error", () => {
    expect(() => fetchLiveRepositorySettings("o/r", failingGh)).toThrow(/boom/);
  });

  test("fails clearly when gh returns an empty body", () => {
    expect(() => fetchLiveRepositorySettings("o/r", emptyGh)).toThrow(/did not return JSON/);
  });

  test("reads a JSON null field as a missing setting", () => {
    const live = fetchLiveRepositorySettings(
      "o/r",
      fakeGh({
        "repos/o/r": JSON.parse('{"security_and_analysis": null, "homepage": null}') as unknown,
        "repos/o/r/private-vulnerability-reporting": { enabled: false },
        "repos/o/r/rulesets": [],
      }),
    );
    expect(live.settings.secretScanning).toBeUndefined();
    expect(live.settings.homepage).toBeUndefined();
  });
});

function captureErrors(run: () => number): {
  exitCode: number;
  output: string;
} {
  const errorLines: string[] = [];
  const logLines: string[] = [];
  const errorSpy = spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    errorLines.push(parts.join(" "));
  });
  const logSpy = spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    logLines.push(parts.join(" "));
  });
  try {
    const exitCode = run();
    return { exitCode, output: errorLines.join("\n") };
  } finally {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  }
}

describe("runRepositorySettingsCheck", () => {
  const matchingRoutes: Record<string, unknown> = {
    [`repos/${repository}`]: {
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      allow_auto_merge: true,
      allow_update_branch: true,
      squash_merge_commit_title: "PR_TITLE",
      squash_merge_commit_message: "PR_BODY",
      homepage: expected.settings.homepage,
      topics: expected.topics,
      security_and_analysis: {
        secret_scanning: { status: "enabled" },
        secret_scanning_push_protection: { status: "enabled" },
      },
    },
    [`repos/${repository}/private-vulnerability-reporting`]: { enabled: true },
    [`repos/${repository}/rulesets`]: Object.keys(expected.rulesets).map((name, index) => ({
      id: index + 1,
      name,
    })),
    ...Object.fromEntries(
      Object.values(expected.rulesets).map((ruleset, index) => [
        `repos/${repository}/rulesets/${String(index + 1)}`,
        ruleset,
      ]),
    ),
  };

  test("returns 0 when the live settings match", () => {
    expect(captureErrors(() => runRepositorySettingsCheck(fakeGh(matchingRoutes)))).toEqual({
      exitCode: 0,
      output: "",
    });
  });

  test("returns 1 and names the rule the live ruleset lacks", () => {
    const develop = structuredClone(expected.rulesets.develop) as {
      rules: { type: string }[];
    };
    develop.rules = develop.rules.filter((rule) => rule.type !== "required_signatures");
    const developIndex = Object.keys(expected.rulesets).indexOf("develop") + 1;
    const result = captureErrors(() =>
      runRepositorySettingsCheck(
        fakeGh({
          ...matchingRoutes,
          [`repos/${repository}/rulesets/${String(developIndex)}`]: develop,
        }),
      ),
    );
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("ruleset develop.rules.required_signatures");
  });

  test("returns 1 with the login hint when gh is unauthenticated", () => {
    const result = captureErrors(() => runRepositorySettingsCheck(unauthenticatedGh));
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("gh auth login");
  });

  test("returns 1 with the 404 message when the repository is not visible", () => {
    const result = captureErrors(() => runRepositorySettingsCheck(fakeGh({})));
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("404");
  });
});
