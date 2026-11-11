import { describe, expect, test } from "bun:test";

import {
  countDeviations,
  describeOverflow,
  DOCUMENTED_EXCEPTIONS,
  failedMeasurements,
  findMissingTexts,
  formatReport,
  isDocumentedMeasurement,
  isMissingSoundAsset,
  isWithinTolerance,
  normalizeText,
  parsePixels,
  resolveCanvasPath,
} from "./fidelity-audit-core";

describe("normalizeText", () => {
  test("collapses whitespace and curly quotes", () => {
    expect(normalizeText("  Andry’s \n  site\u{A0} ")).toBe("Andry's site");
  });
});

describe("findMissingTexts", () => {
  test("reports canvas strings absent from the rendered text", () => {
    const missing = findMissingTexts("home", ["Hello", "Gone", "Gone", " "], ["Hello world"], []);
    expect(missing).toEqual([{ scene: "home", text: "Gone" }]);
  });

  test("ignores case and text split across nodes", () => {
    const missing = findMissingTexts(
      "home",
      ["COMING SOON", "75,000+ installs"],
      ["Coming soon", "75,000", "+ installs"],
      [],
    );
    expect(missing).toEqual([]);
  });

  test("skips documented exceptions", () => {
    const missing = findMissingTexts("home", ["Disponible"], [], [/^Disponible$/]);
    expect(missing).toEqual([]);
  });
});

describe("measurements", () => {
  test("parses pixel lengths only", () => {
    expect(parsePixels("20px")).toBe(20);
    expect(parsePixels("1.5px")).toBe(1.5);
    expect(parsePixels("auto")).toBeUndefined();
  });

  test("applies the tolerance and treats a missing value as a failure", () => {
    expect(isWithinTolerance(20.4, 20, 0.5)).toBe(true);
    expect(isWithinTolerance(21, 20, 0.5)).toBe(false);
    expect(isWithinTolerance(undefined, 20, 0.5)).toBe(false);
  });

  test("keeps only the failing results", () => {
    const results = [
      { id: "a", scene: "s", expected: 20, actual: 20 },
      { id: "b", scene: "s", expected: 8, actual: 4 },
    ];
    expect(failedMeasurements(results, 0.5).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("report", () => {
  const sections = [
    { title: "Text", lines: ["a", "b"] },
    { title: "Overflow", lines: [] },
  ];

  test("counts every line", () => {
    expect(countDeviations(sections)).toBe(2);
  });

  test("renders sections, empty markers and the total", () => {
    const report = formatReport(sections);
    expect(report).toContain("## Text (2)");
    expect(report).toContain("## Overflow (0)\n\n- none");
    expect(report).toContain("Total deviations: 2");
  });
});

describe("resolveCanvasPath", () => {
  test("prefers the argument over the environment", () => {
    expect(resolveCanvasPath(["--x", "a.html"], { FIDELITY_CANVAS: "b" })).toBe("a.html");
    expect(resolveCanvasPath([], { FIDELITY_CANVAS: "b" })).toBe("b");
    expect(resolveCanvasPath([], {})).toBeUndefined();
  });
});

describe("isMissingSoundAsset", () => {
  const miss = "Failed to load resource: the server responded with a status of 404 (Not Found)";

  test("accepts a 404 on a sound file", () => {
    expect(isMissingSoundAsset(miss, "http://127.0.0.1:4418/sounds/tap.mp3")).toBe(true);
  });

  test("rejects a 404 elsewhere and other sound errors", () => {
    expect(isMissingSoundAsset(miss, "http://127.0.0.1:4418/app.js")).toBe(false);
    expect(isMissingSoundAsset("Uncaught TypeError", "http://x/sounds/tap.mp3")).toBe(false);
  });
});

describe("DOCUMENTED_EXCEPTIONS", () => {
  test("lists unique ids with a reason", () => {
    const ids = DOCUMENTED_EXCEPTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("epidemic-sound-files");
    expect(DOCUMENTED_EXCEPTIONS.every((entry) => entry.reason !== "")).toBe(true);
  });
});

describe("describeOverflow", () => {
  test("labels a finding with route, width and scroll state", () => {
    const state = {
      route: "/about/",
      language: "es",
      theme: "dark",
      width: 320,
      scrolled: true,
    };
    expect(describeOverflow(state, "div right 330 > 320")).toBe(
      "/about/ es dark @320 scrolled: div right 330 > 320",
    );
    expect(describeOverflow({ ...state, scrolled: false }, "x")).toBe(
      "/about/ es dark @320 top: x",
    );
  });
});

describe("isDocumentedMeasurement", () => {
  test("accepts the compact dock button on phones only", () => {
    expect(isDocumentedMeasurement("dock button width @390", 36)).toBe(true);
    expect(isDocumentedMeasurement("dock button width @320", 34)).toBe(true);
    expect(isDocumentedMeasurement("dock button width @1440", 36)).toBe(false);
    expect(isDocumentedMeasurement("Find me button width @390", 36)).toBe(false);
  });

  test("still fails a missing or out-of-band dock button", () => {
    expect(isDocumentedMeasurement("dock button width @390")).toBe(false);
    expect(isDocumentedMeasurement("dock button width @390", 20)).toBe(false);
    expect(isDocumentedMeasurement("dock button width @390", 44)).toBe(false);
  });
});
