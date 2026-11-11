import { describe, expect, test } from "bun:test";

import { findFlakyTests, renderSummary } from "./flaky-summary";

const spec = (title: string, statuses: string[]) => ({
  title,
  file: "a.spec.ts",
  tests: [{ results: statuses.map((status) => ({ status })) }],
});

describe("findFlakyTests", () => {
  test("reports only tests that failed then passed", () => {
    const report = {
      suites: [
        {
          suites: [
            {
              specs: [
                spec("flaky", ["failed", "passed"]),
                spec("stable", ["passed"]),
                spec("broken", ["failed", "failed"]),
              ],
            },
          ],
        },
      ],
    };
    expect(findFlakyTests(report)).toEqual(["a.spec.ts: flaky"]);
  });

  test("handles an empty report", () => {
    expect(findFlakyTests({})).toEqual([]);
  });
});

describe("renderSummary", () => {
  test("lists flaky tests or says none", () => {
    expect(renderSummary([])).toContain("None.");
    expect(renderSummary(["a: b"])).toContain("- a: b");
  });
});
