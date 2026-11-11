import { appendFileSync, existsSync, readFileSync } from "node:fs";

interface ReportResult {
  status: string;
}

interface ReportTest {
  results: ReportResult[];
}

interface ReportSpec {
  title: string;
  file: string;
  tests: ReportTest[];
}

interface ReportSuite {
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}

/**
The slice of Playwright's JSON report this script reads.
 */
export interface PlaywrightReport {
  suites?: ReportSuite[];
}

const collectSpecs = (suite: ReportSuite): ReportSpec[] => [
  ...(suite.specs ?? []),
  ...(suite.suites ?? []).flatMap((suite) => collectSpecs(suite)),
];

/**
 * Lists the tests that failed at least once and then passed on a retry.
 * @param report A parsed Playwright JSON report.
 * @returns `file: title` for each flaky test.
 */
export function findFlakyTests(report: PlaywrightReport): string[] {
  return (report.suites ?? [])
    .flatMap((suite) => collectSpecs(suite))
    .filter((spec) =>
      spec.tests.some(
        ({ results }) =>
          results.length > 1 &&
          results.at(-1)?.status === "passed" &&
          results.some(({ status }) => status !== "passed"),
      ),
    )
    .map((spec) => `${spec.file}: ${spec.title}`);
}

/**
 * Renders the Markdown shown in the job summary.
 * @param flaky The flaky test names.
 * @returns A short Markdown section.
 */
export function renderSummary(flaky: readonly string[]): string {
  if (flaky.length === 0) return "### Flaky e2e tests\n\nNone.\n";
  const items = flaky.map((name) => `- ${name}`).join("\n");
  return `### Flaky e2e tests\n\n${items}\n`;
}

if (import.meta.main) {
  const reportPath = process.argv[2] ?? "test-results/report.json";
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as PlaywrightReport;
    const summary = renderSummary(findFlakyTests(report));
    if (summaryPath === undefined) console.log(summary);
    else appendFileSync(summaryPath, summary);
  }
}
