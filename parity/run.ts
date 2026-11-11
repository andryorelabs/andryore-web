import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import tseslint from "typescript-eslint";

import { NATIVE_PORTS } from "../eslint-rules/oxlint-rules.mjs";
import {
  diffFindings,
  findingKey,
  parseAccepted,
  parseEslintJson,
  parseOxlintJson,
  remapNativePorts,
  resolveGate,
  type AcceptedEntry,
  type Finding,
  type FindingsDiff,
} from "./diff";
import { resolveEquivalences } from "./equivalences";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const PARITY_DIR = import.meta.dirname;
const FIXTURE_TREE = path.join(PARITY_DIR, "fixtures", "tree");
const EXPECTED_FILE = path.join(PARITY_DIR, "fixtures", "expected.json");
const DEFAULT_ACCEPTED = path.join(PARITY_DIR, "accepted.json");
const DEFAULT_CORPUS_DIR = path.join(PARITY_DIR, ".corpus");
const ASTRO_GLOB = "**/*.astro";
const DEFAULT_REPORT = path.join(PARITY_DIR, ".out", "report.json");

const HELP = `bun parity/run.ts [options]

Differential lint parity: runs ESLint (current config) and, when --oxlint
points at a binary, Oxlint over the same inputs and diffs the findings per (file, line, rule).
Exits 1 when ESLint reports something Oxlint does not and no accepted.json
entry explains it. Without --oxlint there is nothing to compare against:
every ESLint finding is printed and the run exits 0. .astro files are out of
the comparison: they stay on ESLint.

Modes (--mode)
  fixtures   (default) Violation fixtures in parity/fixtures/tree, one or more
             per enforced policy and rule family. They are copied to their
             repo-relative path (so path-scoped config blocks apply), linted,
             and removed again. ESLint must flag every fixture listed in
             parity/fixtures/expected.json or the run fails (harness error).
  corpus     External TS/React repos shallow-cloned into the corpus directory
             (never committed) and linted with the repo config.
  all        fixtures then corpus.

Type-aware (--type-aware)
  Passes --type-aware to Oxlint (tsgolint). ESLint always runs with type
  information. Without the flag, ESLint findings from typescript-eslint rules
  that require type information are excluded from the comparison, since
  Oxlint does not run them.

accepted.json (--accepted, default parity/accepted.json)
  JSON array of explained gaps: { "file", "line"?, "rule", "reason" }. A
  missing "line" covers every line of that file and rule. "reason" is
  mandatory. Entries that match nothing are reported as stale. A gap that
  cannot be closed must be raised to a human, not added here silently.

Options
  --mode <fixtures|corpus|all>   what to lint (default fixtures)
  --oxlint <path>                Oxlint binary to compare against (optional)
  --oxlint-config <path>         Oxlint config (default .oxlintrc.json or
                                 oxlint.config.ts at the repo root)
  --type-aware                   run Oxlint with --type-aware
  --accepted <path>              accepted gaps file
  --corpus-dir <path>            where corpus repos are cloned
  --report <path>                JSON report (default parity/.out/report.json)
  --help                         show this text
`;

interface CorpusRepository {
  name: string;
  url: string;
  subdirectory: string;
  commit: string;
}

const CORPUS: CorpusRepository[] = [
  {
    name: "vercel-commerce",
    url: "https://github.com/vercel/commerce.git",
    subdirectory: ".",
    commit: "f7521d57d29f0eb3d23c1399cf9bb299d61fcd21",
  },
  {
    name: "shadcn-taxonomy",
    url: "https://github.com/shadcn-ui/taxonomy.git",
    subdirectory: ".",
    commit: "298a8857c7128a0d121e7f699dfd729f23b3966d",
  },
  {
    name: "pmndrs-zustand",
    url: "https://github.com/pmndrs/zustand.git",
    subdirectory: "src",
    commit: "382d29c485e67018c06e75ec7235130d0968522c",
  },
];

type Mode = "fixtures" | "corpus" | "all";

interface Options {
  mode: Mode;
  oxlintBinary: string | undefined;
  oxlintConfig: string | undefined;
  isTypeAware: boolean;
  accepted: string;
  corpusDirectory: string;
  report: string;
}

function parseOptions(argv: string[]): Options | undefined {
  const { values } = parseArgs({
    args: argv,
    options: {
      mode: { type: "string", default: "fixtures" },
      oxlint: { type: "string" },
      "oxlint-config": { type: "string" },
      "type-aware": { type: "boolean", default: false },
      accepted: { type: "string", default: DEFAULT_ACCEPTED },
      "corpus-dir": { type: "string", default: DEFAULT_CORPUS_DIR },
      report: { type: "string", default: DEFAULT_REPORT },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) return undefined;
  const mode = values.mode;
  if (!["fixtures", "corpus", "all"].includes(mode)) {
    throw new Error(`--mode must be fixtures, corpus or all (got "${mode}")`);
  }
  return {
    mode: mode as Mode,
    oxlintBinary: values.oxlint === undefined ? undefined : path.resolve(values.oxlint),
    oxlintConfig:
      values["oxlint-config"] === undefined ? undefined : path.resolve(values["oxlint-config"]),
    isTypeAware: values["type-aware"],
    accepted: path.resolve(values.accepted),
    corpusDirectory: path.resolve(values["corpus-dir"]),
    report: path.resolve(values.report),
  };
}

interface TypescriptEslintPlugin {
  rules: Record<string, { meta?: { docs?: { requiresTypeChecking?: boolean } } }>;
}

function typeAwareRuleIds(): Set<string> {
  const rules = (tseslint.plugin as unknown as TypescriptEslintPlugin).rules;
  return new Set(
    Object.entries(rules)
      .filter(([, rule]) => rule.meta?.docs?.requiresTypeChecking === true)
      .map(([name]) => `@typescript-eslint/${name}`),
  );
}

function runProcess(
  command: string,
  arguments_: string[],
  environment: Record<string, string> = {},
): { stdout: string; status: number | null } {
  const result = spawnSync(command, arguments_, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
    env: { ...process.env, ...environment },
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout, status: result.status };
}

function runEslint(targets: string[], environment: Record<string, string> = {}): Finding[] {
  const { stdout, status } = runProcess(
    "bunx",
    [
      "eslint",
      "--config",
      "parity/eslint-baseline.config.mjs",
      "--no-cache",
      "--format",
      "json",
      "--ignore-pattern",
      ASTRO_GLOB,
      ...targets,
    ],
    environment,
  );
  if (status !== 0 && status !== 1) {
    throw new Error(`eslint exited with status ${String(status)}`);
  }
  return parseEslintJson(stdout, REPO_ROOT);
}

function oxlintConfigPath(options: Options): string {
  if (options.oxlintConfig !== undefined) return options.oxlintConfig;
  const found = [".oxlintrc.json", "oxlint.config.ts"].find((name) =>
    existsSync(path.join(REPO_ROOT, name)),
  );
  if (found === undefined) throw new Error("No Oxlint config found");
  return found;
}

function runOxlint(
  binary: string,
  targets: string[],
  options: Options,
  environment: Record<string, string> = {},
): Finding[] {
  const { stdout, status } = runProcess(
    binary,
    [
      "--config",
      oxlintConfigPath(options),
      "--format",
      "json",
      "--ignore-pattern",
      ASTRO_GLOB,
      ...(options.isTypeAware ? ["--type-aware"] : []),
      ...targets,
    ],
    environment,
  );
  if (status !== 0 && status !== 1) {
    throw new Error(`oxlint exited with status ${String(status)}`);
  }
  return remapNativePorts(parseOxlintJson(stdout, REPO_ROOT), NATIVE_PORTS);
}

function runOxlintIfRequested(
  targets: string[],
  options: Options,
  environment: Record<string, string> = {},
): Finding[] | undefined {
  return options.oxlintBinary === undefined
    ? undefined
    : runOxlint(options.oxlintBinary, targets, options, environment);
}

const compareText = (left: string, right: string): number => left.localeCompare(right);

function listFiles(directory: string): string[] {
  const entries = readdirSync(directory, {
    recursive: true,
    encoding: "utf8",
  });
  return entries
    .filter((entry) => statSync(path.join(directory, entry)).isFile())
    .toSorted(compareText);
}

const FIXTURE_SUFFIX = ".fixture";

const repositoryPathOf = (fixtureFile: string): string =>
  fixtureFile.endsWith(FIXTURE_SUFFIX) ? fixtureFile.slice(0, -FIXTURE_SUFFIX.length) : fixtureFile;

/**
 * Copies the fixture tree into the repo at each file's repo-relative path
 * (path-scoped config blocks only apply there) and returns the file list plus
 * a cleanup that removes exactly what was copied. Refuses to overwrite. A
 * trailing `.fixture` is dropped from the copy, so a fixture that must not be
 * picked up by `bun test` (such as a `.test.ts`) is stored as `x.test.ts.fixture`.
 * @returns The repo-relative fixture paths and the cleanup callback.
 */
function materializeFixtures(): { files: string[]; cleanup: () => void } {
  const sources = listFiles(FIXTURE_TREE);
  const files = sources.map((source) => repositoryPathOf(source));
  const clash = files.find((file) => existsSync(path.join(REPO_ROOT, file)));
  if (clash !== undefined) {
    throw new Error(`Fixture ${clash} would overwrite an existing repo file`);
  }
  const created: string[] = [];
  for (const [index, source] of sources.entries()) {
    const target = path.join(REPO_ROOT, files[index] ?? source);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(FIXTURE_TREE, source), target);
    created.push(target);
  }
  return {
    files,
    cleanup: () => {
      for (const target of created) rmSync(target, { force: true });
    },
  };
}

function checkExpectedFixtures(
  eslintFindings: readonly Finding[],
  files: readonly string[],
): string[] {
  const expected = JSON.parse(readFileSync(EXPECTED_FILE, "utf8")) as Record<string, string[]>;
  const seen = new Set(eslintFindings.map((item) => `${item.file}|${item.rule}`));
  const problems = Object.entries(expected).flatMap(([file, rules]) =>
    rules
      .filter((rule) => !seen.has(`${file}|${rule}`))
      .map((rule) => `ESLint did not report ${rule} on fixture ${file}`),
  );
  const unlisted = files.filter((file) => !Object.hasOwn(expected, file));
  return [...problems, ...unlisted.map((file) => `Fixture ${file} is missing from expected.json`)];
}

function ensureCorpus(directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  return CORPUS.map((repository) => {
    const target = path.join(directory, repository.name);
    if (!existsSync(target)) {
      const steps = [
        ["init", target],
        ["-C", target, "fetch", "--depth", "1", repository.url, repository.commit],
        ["-C", target, "checkout", "--detach", "FETCH_HEAD"],
      ];
      for (const step of steps) {
        const { status } = runProcess("git", step);
        if (status !== 0) throw new Error(`git ${String(step[0])} failed: ${repository.url}`);
      }
    }
    return path.relative(REPO_ROOT, path.join(target, repository.subdirectory));
  });
}

interface Section {
  name: string;
  eslintFindings: Finding[];
  oxlintFindings: Finding[] | undefined;
  problems: string[];
}

function runFixtures(options: Options): Section {
  const { files, cleanup } = materializeFixtures();
  try {
    const eslintFindings = runEslint(files);
    const oxlintFindings = runOxlintIfRequested(files, options);
    return {
      name: "fixtures",
      eslintFindings,
      oxlintFindings,
      problems: checkExpectedFixtures(eslintFindings, files),
    };
  } finally {
    cleanup();
  }
}

function runCorpus(options: Options): Section {
  const targets = ensureCorpus(options.corpusDirectory);
  const environment = { PARITY_CORPUS: "1" };
  return {
    name: "corpus",
    eslintFindings: runEslint(targets, environment),
    oxlintFindings: runOxlintIfRequested(targets, options, environment),
    problems: [],
  };
}

function formatFinding(finding: Finding): string {
  return `  ${finding.file}:${String(finding.line)}  ${finding.rule}`;
}

function printList(title: string, findings: readonly Finding[]): void {
  console.info(`${title} (${String(findings.length)})`);
  for (const finding of findings) console.info(formatFinding(finding));
}

function loadAccepted(file: string): AcceptedEntry[] {
  return existsSync(file) ? parseAccepted(readFileSync(file, "utf8")) : [];
}

function reportSection(
  section: Section,
  options: Options,
  accepted: readonly AcceptedEntry[],
): { exitCode: 0 | 1; payload: unknown } {
  console.info(`\n== ${section.name} ==`);
  printList("ESLint findings", section.eslintFindings);
  for (const problem of section.problems) console.error(`HARNESS: ${problem}`);
  const problemExit = section.problems.length > 0 ? 1 : 0;
  if (section.oxlintFindings === undefined) {
    console.info("No --oxlint binary given: nothing to compare against.");
    return {
      exitCode: problemExit,
      payload: { eslint: section.eslintFindings, problems: section.problems },
    };
  }
  const typeAwareRules = typeAwareRuleIds();
  const comparable = options.isTypeAware
    ? section.eslintFindings
    : section.eslintFindings.filter((item) => !typeAwareRules.has(item.rule));
  const diff: FindingsDiff = diffFindings(comparable, section.oxlintFindings);
  const equivalence = resolveEquivalences(diff.eslintOnly, section.oxlintFindings);
  const gate = resolveGate(equivalence.remaining, accepted);
  printList("Common", diff.common);
  printList("Oxlint-only", diff.oxlintOnly);
  printList("ESLint-only, covered by equivalence", equivalence.covered);
  printList("ESLint-only, accepted", gate.explained);
  printList("ESLint-only, UNEXPLAINED", gate.unexplained);
  for (const entry of gate.stale) {
    console.warn(`stale accepted entry: ${findingKey({ ...entry, line: entry.line ?? 0 })}`);
  }
  return {
    exitCode: problemExit === 1 || gate.exitCode === 1 ? 1 : 0,
    payload: { diff, equivalence, gate, problems: section.problems },
  };
}

function main(): number {
  const options = parseOptions(process.argv.slice(2));
  if (options === undefined) {
    console.info(HELP);
    return 0;
  }
  const accepted = loadAccepted(options.accepted);
  const sections: Section[] = [];
  if (options.mode !== "corpus") sections.push(runFixtures(options));
  if (options.mode !== "fixtures") sections.push(runCorpus(options));
  const reports = sections.map((section) => reportSection(section, options, accepted));
  mkdirSync(path.dirname(options.report), { recursive: true });
  const payloads = Object.fromEntries(
    sections.map((section, index) => [section.name, reports[index]?.payload]),
  );
  writeFileSync(options.report, JSON.stringify(payloads, undefined, 2));
  console.info(`\nReport written to ${path.relative(REPO_ROOT, options.report)}`);
  return reports.some((report) => report.exitCode === 1) ? 1 : 0;
}

process.exitCode = main();
