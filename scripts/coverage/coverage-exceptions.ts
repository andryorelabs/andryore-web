/**
 * A file that stays under the per-file coverage floor, with the reason tests cannot reach it and its own floor.
 * `lines` and `functions` are fractions set to the measured value; the gate fails when the file drops below them.
 */
export interface CoverageException {
  readonly path: string;
  readonly lines: number;
  readonly functions: number;
  readonly reason: string;
}

/**
 * Files allowed under the per-file floor of 97% lines and 98% functions.
 * Add a test instead of adding an entry; remove an entry as soon as its file meets the floor.
 */
export const coverageExceptions: readonly CoverageException[] = [
  {
    path: "scripts/allow-simple-rm.ts",
    lines: 28 / 31,
    functions: 1,
    reason:
      "The uncovered lines are the `import.meta.main` block that reads the hook payload from the real stdin; `import.meta.main` is false when bun test imports the module, and the decision logic in decideRmApproval is tested.",
  },
  {
    path: "scripts/audit-distribution.ts",
    lines: 82 / 87,
    functions: 1,
    reason:
      "The uncovered lines are the `import.meta.main` CLI block that audits the real dist directory and sets process.exitCode; it never runs under bun test, and auditDirectory is tested.",
  },
  {
    path: "scripts/flaky-summary.ts",
    lines: 22 / 29,
    functions: 1,
    reason:
      "The uncovered lines are the `import.meta.main` block that reads the Playwright report and appends to GITHUB_STEP_SUMMARY; it only runs as a CLI in CI, and findFlakyTests and renderSummary are tested.",
  },
  {
    path: "scripts/hooks/pre-push.ts",
    lines: 43 / 56,
    functions: 2 / 4,
    reason:
      "The uncovered functions spawn `bun run typecheck` and read the real stdin; running them from a test would start a nested typecheck of the repository, and the push decision in checkPush is tested.",
  },
  {
    path: "scripts/render-csp.ts",
    lines: 66 / 78,
    functions: 21 / 23,
    reason:
      "The uncovered lines are the CLI main that reads a built dist and writes the nginx policy file, behind an `import.meta.main` guard that is false under bun test; collectHashes and renderPolicy are tested.",
  },
  {
    path: "scripts/repository-settings-check.ts",
    lines: 223 / 235,
    functions: 21 / 22,
    reason:
      "The uncovered lines spawn the real gh CLI against the live GitHub API and run the process entry point; a test cannot call GitHub, and the comparison logic that consumes the settings is tested.",
  },
];
