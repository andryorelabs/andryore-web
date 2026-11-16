import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { type CoverageException, coverageExceptions } from "./coverage-exceptions";
import committedFloors from "./coverage-floors.json";

/**
 * Minimum "All files" line coverage, as a fraction, read from `coverage-floors.json`. Raise it when coverage rises, never lower it.
 */
export const LINE_THRESHOLD: number = committedFloors.lines;

/**
 * Minimum "All files" function coverage, as a fraction, read from `coverage-floors.json`. Raise it when coverage rises, never lower it.
 */
export const FUNCTION_THRESHOLD: number = committedFloors.functions;

/**
 * Per-file floor for lines, as a fraction.
 */
export const FILE_LINE_FLOOR = 0.97;

/**
 * Per-file floor for functions, as a fraction.
 */
export const FILE_FUNCTION_FLOOR = 0.98;

/**
 * Coverage of one source file, as reported by an lcov record.
 */
export interface FileCoverage {
  readonly path: string;
  readonly linesFound: number;
  readonly linesHit: number;
  readonly functionsFound: number;
  readonly functionsHit: number;
}

/**
 * The "All files" figures: the mean of the per-file fractions, like Bun's text table.
 */
export interface CoverageSummary {
  readonly lines: number;
  readonly functions: number;
  readonly files: number;
}

/**
 * Global coverage thresholds, as fractions.
 */
export interface CoverageThresholds {
  readonly lines: number;
  readonly functions: number;
}

type LcovRecord = { -readonly [Key in keyof FileCoverage]: FileCoverage[Key] };

const LCOV_FIELDS: Readonly<Record<string, keyof Omit<LcovRecord, "path">>> = {
  "LF:": "linesFound",
  "LH:": "linesHit",
  "FNF:": "functionsFound",
  "FNH:": "functionsHit",
};

/**
 * Parses lcov text into one {@link FileCoverage} per `SF:` record.
 * @param lcov The contents of an lcov report.
 * @returns One entry per file record.
 */
export function parseLcov(lcov: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: LcovRecord | undefined;
  for (const rawLine of lcov.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("SF:")) {
      current = {
        path: line.slice(3).replaceAll("\\", "/"),
        linesFound: 0,
        linesHit: 0,
        functionsFound: 0,
        functionsHit: 0,
      };
    } else if (current !== undefined && line === "end_of_record") {
      files.push(current);
      current = undefined;
    } else if (current !== undefined) {
      const prefix = Object.keys(LCOV_FIELDS).find((candidate) => line.startsWith(candidate));
      const field = prefix === undefined ? undefined : LCOV_FIELDS[prefix];
      if (prefix !== undefined && field !== undefined) {
        current[field] = Number(line.slice(prefix.length));
      }
    }
  }
  return files;
}

function fraction(hit: number, found: number): number {
  return found === 0 ? 1 : hit / found;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Averages the per-file line and function fractions. A file with nothing to measure counts as fully covered.
 * @param files The per-file coverage records.
 * @returns The "All files" summary.
 */
export function summarize(files: readonly FileCoverage[]): CoverageSummary {
  return {
    lines: mean(files.map((file) => fraction(file.linesHit, file.linesFound))),
    functions: mean(files.map((file) => fraction(file.functionsHit, file.functionsFound))),
    files: files.length,
  };
}

function describeFile(file: FileCoverage): string {
  const lines = percent(fraction(file.linesHit, file.linesFound));
  const functions = percent(fraction(file.functionsHit, file.functionsFound));
  return `${lines} lines and ${functions} functions`;
}

function findFileFailures(
  files: readonly FileCoverage[],
  exceptions: readonly CoverageException[],
): string[] {
  const failures: string[] = [];
  const excepted = new Map(exceptions.map((exception) => [exception.path, exception]));
  for (const file of files) {
    const lines = fraction(file.linesHit, file.linesFound);
    const functions = fraction(file.functionsHit, file.functionsFound);
    const underFloor = lines < FILE_LINE_FLOOR || functions < FILE_FUNCTION_FLOOR;
    const exception = excepted.get(file.path);
    if (exception === undefined) {
      if (underFloor) {
        failures.push(
          `${file.path} has ${describeFile(file)}, below the ${percent(FILE_LINE_FLOOR)} lines and ${percent(FILE_FUNCTION_FLOOR)} functions floor, and has no coverage exception.`,
        );
      }
    } else if (!underFloor) {
      failures.push(
        `Coverage exception for ${file.path} is stale: the file now has ${describeFile(file)}. Remove the exception.`,
      );
    } else if (lines < exception.lines || functions < exception.functions) {
      failures.push(
        `${file.path} has ${describeFile(file)}, below its exception floor of ${percent(exception.lines)} lines and ${percent(exception.functions)} functions.`,
      );
    }
  }
  const reported = new Set(files.map((file) => file.path));
  for (const exception of exceptions) {
    if (!reported.has(exception.path)) {
      failures.push(
        `Coverage exception for ${exception.path} names a file missing from the report.`,
      );
    }
    if (exception.reason.trim() === "" || /\btodo\b/i.test(exception.reason)) {
      failures.push(
        `Coverage exception for ${exception.path} needs a written reason that says why tests cannot reach the file.`,
      );
    }
  }
  return failures;
}

/**
 * Lists one message per failed check: an "All files" metric under its threshold, a file under the per-file floor
 * without an exception, and an exception that is stale, missing from the report, unexplained or under its own floor.
 * @param summary The "All files" summary.
 * @param thresholds The global thresholds.
 * @param files The per-file records.
 * @param exceptions The allowed per-file exceptions.
 * @returns The failure messages; empty when the gate passes.
 */
export function findThresholdFailures(
  summary: CoverageSummary,
  thresholds: CoverageThresholds = { lines: LINE_THRESHOLD, functions: FUNCTION_THRESHOLD },
  files: readonly FileCoverage[] = [],
  exceptions: readonly CoverageException[] = [],
): string[] {
  if (summary.files === 0) return ["The coverage report lists no files."];
  const failures: string[] = [];
  if (summary.lines < thresholds.lines) {
    failures.push(
      `Line coverage ${percent(summary.lines)} is below the ${percent(thresholds.lines)} threshold.`,
    );
  }
  if (summary.functions < thresholds.functions) {
    failures.push(
      `Function coverage ${percent(summary.functions)} is below the ${percent(thresholds.functions)} threshold.`,
    );
  }
  failures.push(...findFileFailures(files, exceptions));
  return failures;
}

/**
 * Reads `coverage/lcov.info` under `repoRoot` and returns the gate failures, or a single message when the report is missing.
 * @param repoRoot The repository root.
 * @param exceptions The allowed per-file exceptions.
 * @param thresholds The global thresholds.
 * @returns The failure messages; empty when the gate passes.
 */
export function checkCoverageReport(
  repoRoot: string,
  exceptions: readonly CoverageException[] = coverageExceptions,
  thresholds: CoverageThresholds = committedFloors,
): string[] {
  const reportPath = path.resolve(repoRoot, "coverage/lcov.info");
  if (!existsSync(reportPath)) {
    return [`No coverage report at ${reportPath}; run bun test with coverage enabled first.`];
  }
  const files = parseLcov(readFileSync(reportPath, "utf8"));
  return findThresholdFailures(summarize(files), thresholds, files, exceptions);
}
