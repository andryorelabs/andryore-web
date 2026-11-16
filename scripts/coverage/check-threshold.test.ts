import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  checkCoverageReport,
  FILE_FUNCTION_FLOOR,
  FILE_LINE_FLOOR,
  findThresholdFailures,
  FUNCTION_THRESHOLD,
  LINE_THRESHOLD,
  parseLcov,
  summarize,
  type FileCoverage,
} from "./check-threshold";
import type { CoverageException } from "./coverage-exceptions";

const THRESHOLDS = { lines: 0.1, functions: 0.1 };

function file(overrides: Partial<FileCoverage> = {}): FileCoverage {
  return {
    path: "src/a.ts",
    linesFound: 100,
    linesHit: 100,
    functionsFound: 10,
    functionsHit: 10,
    ...overrides,
  };
}

function exception(overrides: Partial<CoverageException> = {}): CoverageException {
  return {
    path: "src/a.ts",
    lines: 0.5,
    functions: 0.5,
    reason: "the entry point reads the real stdin, which a test cannot supply",
    ...overrides,
  };
}

function failuresFor(
  files: readonly FileCoverage[],
  exceptions: readonly CoverageException[] = [],
): string[] {
  return findThresholdFailures(summarize(files), THRESHOLDS, files, exceptions);
}

describe("parseLcov", () => {
  test("reads one record per file and normalises separators", () => {
    const lcov = [
      "TN:",
      "SF:src\\a.ts",
      "FNF:4",
      "FNH:3",
      "LF:10",
      "LH:9",
      "end_of_record",
      "SF:src/b.ts",
      "LF:2",
      "LH:2",
      "end_of_record",
    ].join("\r\n");
    expect(parseLcov(lcov)).toEqual([
      { path: "src/a.ts", linesFound: 10, linesHit: 9, functionsFound: 4, functionsHit: 3 },
      { path: "src/b.ts", linesFound: 2, linesHit: 2, functionsFound: 0, functionsHit: 0 },
    ]);
  });

  test("ignores fields outside a record and unknown fields", () => {
    expect(parseLcov("LF:3\nDA:1,1\nSF:x.ts\nDA:1,1\nend_of_record")).toEqual([
      { path: "x.ts", linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
    ]);
  });
});

describe("summarize", () => {
  test("averages per-file fractions and counts empty files as covered", () => {
    const summary = summarize([
      file({ linesHit: 50, functionsHit: 5 }),
      file({ linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 }),
    ]);
    expect(summary).toEqual({ lines: 0.75, functions: 0.75, files: 2 });
  });
});

describe("findThresholdFailures", () => {
  test("passes when every file meets the floor", () => {
    expect(failuresFor([file()])).toEqual([]);
  });

  test("fails an empty report", () => {
    expect(failuresFor([])).toEqual(["The coverage report lists no files."]);
  });

  test("fails when the global thresholds are not met", () => {
    const failures = findThresholdFailures({ lines: 0.5, functions: 0.5, files: 1 }, { lines: 0.9, functions: 0.9 });
    expect(failures).toEqual([
      "Line coverage 50.00% is below the 90.00% threshold.",
      "Function coverage 50.00% is below the 90.00% threshold.",
    ]);
  });

  test("uses the committed thresholds by default", () => {
    expect(LINE_THRESHOLD).toBeGreaterThan(0);
    expect(FUNCTION_THRESHOLD).toBeGreaterThan(0);
    const failures = findThresholdFailures({ lines: 0, functions: 0, files: 1 });
    expect(failures).toHaveLength(2);
  });

  test("fails a file under the line floor without an exception", () => {
    const failures = failuresFor([file({ linesHit: 96 })]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("src/a.ts has 96.00% lines and 100.00% functions");
    expect(failures[0]).toContain("no coverage exception");
  });

  test("fails a file under the function floor without an exception", () => {
    const failures = failuresFor([file({ functionsFound: 100, functionsHit: 97 })]);
    expect(failures[0]).toContain("97.00% functions");
  });

  test("accepts files exactly on the floors", () => {
    expect(FILE_LINE_FLOOR).toBe(0.97);
    expect(FILE_FUNCTION_FLOOR).toBe(0.98);
    expect(
      failuresFor([file({ linesHit: 97, functionsFound: 100, functionsHit: 98 })]),
    ).toEqual([]);
  });

  test("accepts an excepted file at or above its own floor", () => {
    const failures = failuresFor([file({ linesHit: 60 })], [exception({ lines: 0.6 })]);
    expect(failures.filter((message) => message.includes("exception floor"))).toEqual([]);
  });

  test("fails an excepted file that drops below its own floor", () => {
    const failures = failuresFor([file({ linesHit: 59 })], [exception({ lines: 0.6 })]);
    expect(failures).toEqual([
      "src/a.ts has 59.00% lines and 100.00% functions, below its exception floor of 60.00% lines and 50.00% functions.",
    ]);
  });

  test("fails a stale exception on a file that meets the floor", () => {
    const failures = failuresFor([file()], [exception()]);
    expect(failures).toEqual([
      "Coverage exception for src/a.ts is stale: the file now has 100.00% lines and 100.00% functions. Remove the exception.",
    ]);
  });

  test("fails an exception for a file missing from the report", () => {
    const failures = failuresFor([file()], [exception({ path: "src/gone.ts" })]);
    expect(failures).toEqual([
      "Coverage exception for src/gone.ts names a file missing from the report.",
    ]);
  });

  test("rejects an empty or TODO reason", () => {
    for (const reason of ["  ", "TODO", "todo: write this later"]) {
      const failures = failuresFor([file({ linesHit: 60 })], [exception({ lines: 0.6, reason })]);
      expect(failures).toEqual([
        "Coverage exception for src/a.ts needs a written reason that says why tests cannot reach the file.",
      ]);
    }
  });
});

describe("checkCoverageReport", () => {
  const directories: string[] = [];

  function repositoryWith(lcov: string | undefined): string {
    const directory = mkdtempSync(path.join(tmpdir(), "coverage-gate-"));
    directories.push(directory);
    if (lcov !== undefined) {
      mkdirSync(path.join(directory, "coverage"));
      writeFileSync(path.join(directory, "coverage/lcov.info"), lcov);
    }
    return directory;
  }

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
  });

  test("reports a missing lcov file", () => {
    const failures = checkCoverageReport(repositoryWith(undefined), [], THRESHOLDS);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("No coverage report at");
  });

  test("passes a healthy report and fails a low one", () => {
    const healthy = "SF:a.ts\nLF:10\nLH:10\nFNF:1\nFNH:1\nend_of_record\n";
    const low = "SF:a.ts\nLF:10\nLH:5\nFNF:1\nFNH:1\nend_of_record\n";
    expect(checkCoverageReport(repositoryWith(healthy), [], THRESHOLDS)).toEqual([]);
    expect(checkCoverageReport(repositoryWith(low), [], THRESHOLDS).length).toBeGreaterThan(0);
  });

  test("falls back to the committed exceptions and thresholds", () => {
    const failures = checkCoverageReport(
      repositoryWith("SF:a.ts\nLF:10\nLH:0\nFNF:1\nFNH:0\nend_of_record\n"),
    );
    expect(failures.length).toBeGreaterThan(0);
  });
});
