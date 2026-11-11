import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A JSON value as read from the expected files or from `gh api`.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * The repository settings that the check compares: flat scalar settings,
 * the topic list and the rulesets keyed by name.
 */
export interface RepositorySettings {
  settings: Record<string, string | boolean | undefined>;
  topics: string[];
  rulesets: Record<string, JsonValue>;
}

/**
 * One difference between the expected and the live settings.
 */
export interface SettingDifference {
  setting: string;
  expected: string;
  actual: string;
}

/**
 * Raised when `gh` cannot read the live settings, with a message that says what to do.
 */
export class RepositorySettingsError extends Error {}

/**
 * Runs `gh` with the given arguments and returns the outcome.
 */
export type GhRunner = (arguments_: string[]) => {
  status: number;
  stdout: string;
  stderr: string;
};

const MISSING = "(missing)";

function show(value: JsonValue): string {
  return value === undefined ? MISSING : JSON.stringify(value);
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && Boolean(value) && !Array.isArray(value);
}

function isEqual(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareSubset(
  path: string,
  expected: JsonValue,
  live: JsonValue,
  differences: SettingDifference[],
): void {
  if (live !== undefined && isRecord(expected) && isRecord(live)) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      compareSubset(`${path}.${key}`, expectedValue, live[key], differences);
    }
    return;
  }
  const isEqualValue = Array.isArray(expected) ? isEqual(expected, live) : expected === live;
  if (!isEqualValue)
    differences.push({
      setting: path,
      expected: show(expected),
      actual: show(live),
    });
}

function ruleTypes(ruleset: Record<string, JsonValue>): Map<string, JsonValue> {
  const rules = ruleset.rules;
  const byType = new Map<string, JsonValue>();
  if (!Array.isArray(rules)) return byType;
  for (const rule of rules) {
    if (isRecord(rule) && typeof rule.type === "string") byType.set(rule.type, rule);
  }
  return byType;
}

function compareRuleset(
  name: string,
  expected: JsonValue,
  live: JsonValue,
  differences: SettingDifference[],
): void {
  const path = `ruleset ${name}`;
  if (live === undefined) {
    differences.push({ setting: path, expected: "present", actual: MISSING });
    return;
  }
  if (!isRecord(expected) || !isRecord(live)) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (key === "rules" || key === "name") continue;
    compareSubset(`${path}.${key}`, expectedValue, live[key], differences);
  }
  const liveRules = ruleTypes(live);
  for (const [type, expectedRule] of ruleTypes(expected)) {
    const liveRule = liveRules.get(type);
    if (liveRule === undefined) {
      differences.push({
        setting: `${path}.rules.${type}`,
        expected: "present",
        actual: MISSING,
      });
      continue;
    }
    compareSubset(`${path}.rules.${type}`, expectedRule, liveRule, differences);
  }
  const expectedTypes = ruleTypes(expected);
  for (const type of liveRules.keys()) {
    if (!expectedTypes.has(type)) {
      differences.push({
        setting: `${path}.rules.${type}`,
        expected: MISSING,
        actual: "present",
      });
    }
  }
}

/**
 * Compares the expected repository settings with the live ones. Every
 * expected scalar, topic, ruleset field and ruleset rule must match; extra
 * fields the live ruleset carries on its own (ids, source) are ignored, while
 * a live rule the expected file does not list is reported.
 * @param expected The settings the repository should have.
 * @param live The settings read from GitHub.
 * @returns Every difference found, empty when the two agree.
 */
export function compareRepositorySettings(
  expected: RepositorySettings,
  live: RepositorySettings,
): SettingDifference[] {
  const differences: SettingDifference[] = [];
  for (const [key, expectedValue] of Object.entries(expected.settings)) {
    const liveValue = live.settings[key];
    if (expectedValue !== liveValue) {
      differences.push({
        setting: `settings.${key}`,
        expected: show(expectedValue),
        actual: show(liveValue),
      });
    }
  }
  for (const topic of expected.topics) {
    if (!live.topics.includes(topic)) {
      differences.push({
        setting: `topics.${topic}`,
        expected: "present",
        actual: MISSING,
      });
    }
  }
  for (const topic of live.topics) {
    if (!expected.topics.includes(topic)) {
      differences.push({
        setting: `topics.${topic}`,
        expected: MISSING,
        actual: "present",
      });
    }
  }
  for (const [name, expectedRuleset] of Object.entries(expected.rulesets)) {
    compareRuleset(name, expectedRuleset, live.rulesets[name], differences);
  }
  return differences;
}

function runGh(arguments_: string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("gh", arguments_, { encoding: "utf8" });
  if (result.error !== undefined) {
    throw new RepositorySettingsError(
      `Could not run the gh CLI (${result.error.message}); install it from https://cli.github.com and try again.`,
    );
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseApiBody(endpoint: string, body: string): JsonValue {
  try {
    return JSON.parse(body) as JsonValue;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new RepositorySettingsError(
      `gh api ${endpoint} did not return JSON (${reason}); run it by hand to see the response.`,
      { cause: error },
    );
  }
}

function readApi(gh: GhRunner, endpoint: string): JsonValue {
  const result = gh(["api", endpoint]);
  if (result.status !== 0) {
    const message = result.stderr || "no error output";
    if (/gh auth login|not logged in|HTTP 401|GH_TOKEN/i.test(message)) {
      throw new RepositorySettingsError(
        `gh is not authenticated; run \`gh auth login\` and try again (${endpoint}).`,
      );
    }
    if (/HTTP 404|Not Found/i.test(message)) {
      throw new RepositorySettingsError(
        `GitHub returned 404 for ${endpoint}; the repository does not exist or the token cannot see it.`,
      );
    }
    throw new RepositorySettingsError(`gh api ${endpoint} failed: ${message.trim()}`);
  }
  return parseApiBody(endpoint, result.stdout);
}

function field(value: JsonValue, key: string): JsonValue {
  return isRecord(value) ? value[key] : undefined;
}

function status(value: JsonValue, key: string): string | undefined {
  const nested = field(field(value, "security_and_analysis"), key);
  const nestedStatus = field(nested, "status");
  return typeof nestedStatus === "string" ? nestedStatus : undefined;
}

function scalar(value: JsonValue): string | boolean | undefined {
  return typeof value === "string" || typeof value === "boolean" ? value : undefined;
}

/**
 * Reads the live repository settings, topics and rulesets with `gh api`.
 * Never writes: it only issues GET requests.
 * @param repository Owner and name joined by a slash.
 * @param gh The `gh` runner, defaults to the real CLI.
 * @returns A snapshot of what GitHub currently has configured.
 * @throws {RepositorySettingsError} When `gh` is unauthenticated, the repository is a 404 or a call fails.
 */
export function fetchLiveRepositorySettings(
  repository: string,
  gh: GhRunner = runGh,
): RepositorySettings {
  const repositoryData = readApi(gh, `repos/${repository}`);
  const reporting = readApi(gh, `repos/${repository}/private-vulnerability-reporting`);
  const summaries = readApi(gh, `repos/${repository}/rulesets`);
  const rulesets: Record<string, JsonValue> = {};
  const summaryList = Array.isArray(summaries) ? summaries : [];
  for (const summary of summaryList) {
    const id = field(summary, "id");
    const name = field(summary, "name");
    if (typeof name === "string" && (typeof id === "number" || typeof id === "string")) {
      rulesets[name] = readApi(gh, `repos/${repository}/rulesets/${String(id)}`);
    }
  }
  const topics = field(repositoryData, "topics");
  return {
    settings: {
      allowSquashMerge: scalar(field(repositoryData, "allow_squash_merge")),
      allowMergeCommit: scalar(field(repositoryData, "allow_merge_commit")),
      allowRebaseMerge: scalar(field(repositoryData, "allow_rebase_merge")),
      deleteBranchOnMerge: scalar(field(repositoryData, "delete_branch_on_merge")),
      allowAutoMerge: scalar(field(repositoryData, "allow_auto_merge")),
      allowUpdateBranch: scalar(field(repositoryData, "allow_update_branch")),
      squashMergeCommitTitle: scalar(field(repositoryData, "squash_merge_commit_title")),
      squashMergeCommitMessage: scalar(field(repositoryData, "squash_merge_commit_message")),
      secretScanning: status(repositoryData, "secret_scanning"),
      secretScanningPushProtection: status(repositoryData, "secret_scanning_push_protection"),
      privateVulnerabilityReporting: scalar(field(reporting, "enabled")),
      homepage: scalar(field(repositoryData, "homepage")),
    },
    topics: Array.isArray(topics) ? topics.filter((topic) => typeof topic === "string") : [],
    rulesets,
  };
}

/**
 * Loads the expected settings from `scripts/repo-settings.json` and the
 * rulesets from `.github/rulesets/*.json`.
 * @param root The repository root, defaults to the one that holds this script.
 * @returns The repository slug and the expected settings.
 */
export function loadExpectedRepositorySettings(root: URL = new URL("../", import.meta.url)): {
  repository: string;
  expected: RepositorySettings;
} {
  const file = JSON.parse(readFileSync(new URL("scripts/repo-settings.json", root), "utf8")) as {
    repository: string;
    settings: RepositorySettings["settings"];
    topics: string[];
  };
  const rulesetsDirectory = new URL(".github/rulesets/", root);
  const rulesets: Record<string, JsonValue> = {};
  const rulesetFiles = readdirSync(rulesetsDirectory).filter((entry) => entry.endsWith(".json"));
  for (const name of rulesetFiles) {
    const ruleset = JSON.parse(readFileSync(new URL(name, rulesetsDirectory), "utf8")) as JsonValue;
    const rulesetName = field(ruleset, "name");
    rulesets[typeof rulesetName === "string" ? rulesetName : name] = ruleset;
  }
  return {
    repository: file.repository,
    expected: { settings: file.settings, topics: file.topics, rulesets },
  };
}

/**
 * Formats the differences as one line each.
 * @param differences The differences to print.
 * @returns The report text.
 */
export function formatDifferences(differences: SettingDifference[]): string {
  return differences
    .map(({ setting, expected, actual }) => `${setting}: expected ${expected}, got ${actual}`)
    .join("\n");
}

/**
 * Runs the check: prints every difference and returns the exit code.
 * @param gh The `gh` runner, defaults to the real CLI.
 * @returns 0 when the settings agree, 1 on any difference or read failure.
 */
export function runRepositorySettingsCheck(gh: GhRunner = runGh): number {
  try {
    const { repository, expected } = loadExpectedRepositorySettings();
    const differences = compareRepositorySettings(
      expected,
      fetchLiveRepositorySettings(repository, gh),
    );
    if (differences.length === 0) {
      console.log("repo-settings: live settings match the expected ones.");
      return 0;
    }
    console.error(formatDifferences(differences));
    return 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runRepositorySettingsCheck();
}
