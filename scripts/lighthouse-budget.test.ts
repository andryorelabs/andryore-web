import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  auditPages,
  findFailures,
  formatTable,
  median,
  parseReport,
  resolveStaticFile,
  respondWithFile,
  runLighthouseOnce,
  RUNS_PER_PAGE,
  summarizeRuns,
  type CategoryScores,
} from "./lighthouse-budget";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Creates a temporary directory removed after each test.
 * @returns The directory path.
 */
function makeTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "lighthouse-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

/**
 * Writes an executable fake `bunx` with the given shell body.
 * @param script The shell body of the stub.
 * @returns The stub path.
 */
function writeStub(script: string): string {
  const stub = path.join(makeTemporaryDirectory(), "bunx");
  writeFileSync(stub, `#!/bin/sh\n${script}\n`);
  chmodSync(stub, 0o755);
  return stub;
}

/**
 * Builds a Lighthouse JSON report.
 * @param score The 0 to 1 score for every category, or null.
 * @param bytes The total byte weight.
 * @returns The JSON text.
 */
function report(score: number | null, bytes = 2048): string {
  const category = { score };
  return JSON.stringify({
    categories: {
      performance: category,
      accessibility: category,
      "best-practices": category,
      seo: category,
    },
    audits: { "total-byte-weight": { numericValue: bytes } },
  });
}

/**
 * Shell body that prints a report.
 * @param json The report JSON.
 * @returns The script body.
 */
function printing(json: string): string {
  return `cat <<'JSON'\n${json}\nJSON`;
}

const PASSING: CategoryScores = {
  performance: 95,
  accessibility: 100,
  "best-practices": 90,
  seo: 100,
};

describe("median", () => {
  test("picks the middle of an odd list", () => {
    expect(median([90, 100, 50, 95, 80])).toBe(90);
  });

  test("averages the middle pair of an even list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  test("rejects an empty list", () => {
    expect(() => median([])).toThrow();
  });
});

describe("parseReport", () => {
  test("rounds scores to 0-100 and reads the weight", () => {
    const run = parseReport(report(0.934, 5000));
    expect(run.scores.performance).toBe(93);
    expect(run.totalBytes).toBe(5000);
  });

  test("keeps a null score null", () => {
    expect(parseReport(report(null)).scores.seo).toBeUndefined();
  });
});

describe("summarizeRuns", () => {
  test("takes the median per category", () => {
    const runs = [50, 99, 91].map((score) => parseReport(report(score / 100)));
    expect(summarizeRuns(runs).scores.performance).toBe(91);
  });

  test("a null in any run makes the category null", () => {
    const runs = [parseReport(report(0.99)), parseReport(report(null))];
    expect(summarizeRuns(runs).scores.accessibility).toBeUndefined();
  });
});

describe("findFailures", () => {
  test("passes at exactly the threshold", () => {
    expect(findFailures([{ path: "/", scores: PASSING, totalBytes: 1 }])).toEqual([]);
  });

  test("flags a score below 90 and a null score", () => {
    const failures = findFailures([
      {
        path: "/es/",
        scores: { ...PASSING, seo: 89, performance: undefined },
        totalBytes: 1,
      },
    ]);
    expect(failures).toEqual(["/es/ performance: no score", "/es/ seo: 89 < 90"]);
  });

  test("never fails on weight", () => {
    expect(findFailures([{ path: "/", scores: PASSING, totalBytes: 99_000_000 }])).toEqual([]);
  });
});

describe("formatTable", () => {
  test("prints scores and weight in KiB", () => {
    const table = formatTable([{ path: "/", scores: PASSING, totalBytes: 2048 }]);
    expect(table).toContain("2.0 KiB");
    expect(table).toContain("95");
  });
});

describe("runLighthouseOnce", () => {
  test("parses the report printed by a stubbed bunx", async () => {
    const stub = writeStub(printing(report(0.97)));
    const run = await runLighthouseOnce("http://x/", { command: stub });
    expect(run.scores.performance).toBe(97);
  });

  test("throws when bunx exits non-zero", async () => {
    const stub = writeStub("echo boom >&2; exit 3");
    let message = "";
    try {
      await runLighthouseOnce("http://x/", { command: stub });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("boom");
  });
});

describe("auditPages", () => {
  test("runs each page five times and reports the median", async () => {
    const counter = path.join(makeTemporaryDirectory(), "count");
    const stub = writeStub(`echo x >> ${counter}\n${printing(report(0.92))}`);
    const [page] = await auditPages("http://x", ["/"], { command: stub });
    expect(page?.scores.seo).toBe(92);
    const calls = readFileSync(counter, "utf8").trim().split("\n");
    expect(calls).toHaveLength(RUNS_PER_PAGE);
  });

  test("surfaces a null score from the stub as a failure", async () => {
    const stub = writeStub(printing(report(null)));
    const results = await auditPages("http://x", ["/"], { command: stub });
    expect(findFailures(results)).toHaveLength(4);
  });
});

describe("resolveStaticFile", () => {
  test("maps a directory path to its index.html and blocks traversal", () => {
    const directory = makeTemporaryDirectory();
    writeFileSync(path.join(directory, "index.html"), "<html></html>");
    expect(resolveStaticFile(directory, "/")).toBe(path.join(directory, "index.html"));
    expect(resolveStaticFile(directory, "/missing/")).toBeUndefined();
    expect(resolveStaticFile(directory, "/../etc/passwd")).toBeUndefined();
  });

  test("blocks a sibling directory that shares the dist prefix", () => {
    const parent = makeTemporaryDirectory();
    const distribution = path.join(parent, "dist");
    const sibling = path.join(parent, "dist-other");
    mkdirSync(distribution);
    mkdirSync(sibling);
    writeFileSync(path.join(sibling, "secret.txt"), "secret");
    expect(resolveStaticFile(distribution, "/..%2Fdist-other/secret.txt")).toBeUndefined();
  });
});

describe("respondWithFile", () => {
  const largeText = "body { color: red; }\n".repeat(40);

  test("gzips a text asset when the client accepts gzip", async () => {
    const directory = makeTemporaryDirectory();
    const file = path.join(directory, "site.css");
    writeFileSync(file, largeText);
    const response = await respondWithFile(file, "gzip, deflate, br");
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBeLessThan(largeText.length);
    expect(new TextDecoder().decode(Bun.gunzipSync(body))).toBe(largeText);
  });

  test("serves raw bytes without gzip support, below 256 bytes or for binaries", async () => {
    const directory = makeTemporaryDirectory();
    const stylesheet = path.join(directory, "site.css");
    const tiny = path.join(directory, "tiny.css");
    const font = path.join(directory, "font.woff2");
    writeFileSync(stylesheet, largeText);
    writeFileSync(tiny, "a{}");
    writeFileSync(font, largeText);
    for (const [file, acceptEncoding] of [
      [stylesheet, undefined],
      [stylesheet, "identity"],
      [tiny, "gzip"],
      [font, "gzip"],
    ] as const) {
      const response = await respondWithFile(file, acceptEncoding);
      expect(response.headers.get("content-encoding")).toBeNull();
    }
  });
});
