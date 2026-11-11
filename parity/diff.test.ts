import { describe, expect, test } from "bun:test";

import {
  diffFindings,
  findingKey,
  normalizeOxlintRule,
  OXLINT_UNCODED_RULE,
  parseAccepted,
  parseEslintJson,
  parseOxlintJson,
  remapNativePorts,
  resolveGate,
  UNUSED_DIRECTIVE_RULE,
  type AcceptedEntry,
  type Finding,
} from "./diff";

const finding = (file: string, line: number, rule: string): Finding => ({
  file,
  line,
  rule,
});

const directive = (file: string, line: number): Finding =>
  finding(file, line, UNUSED_DIRECTIVE_RULE);

describe("diffFindings", () => {
  test("splits findings into common, eslint-only and oxlint-only", () => {
    const eslint = [finding("a.ts", 1, "no-console"), finding("a.ts", 2, "x")];
    const oxlint = [finding("a.ts", 1, "no-console"), finding("b.ts", 3, "y")];
    const diff = diffFindings(eslint, oxlint);
    expect(diff.common).toEqual([finding("a.ts", 1, "no-console")]);
    expect(diff.eslintOnly).toEqual([finding("a.ts", 2, "x")]);
    expect(diff.oxlintOnly).toEqual([finding("b.ts", 3, "y")]);
  });

  test("collapses duplicates and sorts deterministically", () => {
    const eslint = [finding("b.ts", 2, "r"), finding("a.ts", 9, "r"), finding("a.ts", 9, "r")];
    const diff = diffFindings(eslint, []);
    expect(diff.eslintOnly).toEqual([finding("a.ts", 9, "r"), finding("b.ts", 2, "r")]);
  });

  test("a different line or rule is a different finding", () => {
    const diff = diffFindings(
      [finding("a.ts", 1, "r")],
      [finding("a.ts", 2, "r"), finding("a.ts", 1, "s")],
    );
    expect(diff.common).toEqual([]);
    expect(diff.eslintOnly).toHaveLength(1);
    expect(diff.oxlintOnly).toHaveLength(2);
  });
  describe("position-insensitive rules", () => {
    test("match by file, rule and count regardless of line", () => {
      const diff = diffFindings([directive("a.ts", 1)], [directive("a.ts", 3)]);
      expect(diff.common).toEqual([directive("a.ts", 1)]);
      expect(diff.eslintOnly).toEqual([]);
      expect(diff.oxlintOnly).toEqual([]);
    });

    test("a missing finding still fails the gate", () => {
      const diff = diffFindings([directive("a.ts", 1)], []);
      expect(diff.eslintOnly).toEqual([directive("a.ts", 1)]);
      expect(resolveGate(diff.eslintOnly, []).exitCode).toBe(1);
    });

    test("a missing finding in another file still fails the gate", () => {
      const diff = diffFindings([directive("a.ts", 1)], [directive("b.ts", 1)]);
      expect(resolveGate(diff.eslintOnly, []).exitCode).toBe(1);
    });

    test("a surplus ESLint finding beyond the Oxlint count fails the gate", () => {
      const diff = diffFindings(
        [directive("a.ts", 1), directive("a.ts", 5)],
        [directive("a.ts", 3)],
      );
      expect(diff.common).toHaveLength(1);
      expect(diff.eslintOnly).toHaveLength(1);
      expect(resolveGate(diff.eslintOnly, []).exitCode).toBe(1);
    });

    test("line-sensitive rules still need the same line", () => {
      const diff = diffFindings([finding("a.ts", 1, "r")], [finding("a.ts", 3, "r")]);
      expect(diff.eslintOnly).toHaveLength(1);
    });
  });
});

describe("parseAccepted", () => {
  test("accepts entries with a reason", () => {
    const entries = parseAccepted(
      JSON.stringify([{ file: "a.ts", line: 1, rule: "r", reason: "why" }]),
    );
    expect(entries).toEqual([{ file: "a.ts", line: 1, rule: "r", reason: "why" }]);
  });

  test("rejects an entry without a reason", () => {
    expect(() => parseAccepted(JSON.stringify([{ file: "a.ts", line: 1, rule: "r" }]))).toThrow(
      /reason/,
    );
  });

  test("rejects a blank reason", () => {
    expect(() =>
      parseAccepted(JSON.stringify([{ file: "a.ts", rule: "r", reason: " ".repeat(3) }])),
    ).toThrow(/reason/);
  });

  test("rejects a non-array document", () => {
    expect(() => parseAccepted("{}")).toThrow(/array/);
  });

  test("a missing line means every line of that file and rule", () => {
    const [entry] = parseAccepted(JSON.stringify([{ file: "a.ts", rule: "r", reason: "why" }]));
    expect(entry?.line).toBeUndefined();
  });
});

describe("resolveGate", () => {
  const accepted: AcceptedEntry[] = [
    { file: "a.ts", line: 1, rule: "r", reason: "explained" },
    { file: "b.ts", rule: "s", reason: "whole file" },
    { file: "gone.ts", line: 5, rule: "z", reason: "stale" },
  ];

  test("fails on unexplained eslint-only findings", () => {
    const result = resolveGate([finding("c.ts", 1, "r")], accepted);
    expect(result.unexplained).toEqual([finding("c.ts", 1, "r")]);
    expect(result.exitCode).toBe(1);
  });

  test("passes when every eslint-only finding is accepted", () => {
    const result = resolveGate([finding("a.ts", 1, "r"), finding("b.ts", 40, "s")], accepted);
    expect(result.unexplained).toEqual([]);
    expect(result.explained.map((item) => item.reason)).toEqual(["explained", "whole file"]);
    expect(result.exitCode).toBe(0);
  });

  test("reports accepted entries that matched nothing as stale", () => {
    const result = resolveGate([finding("a.ts", 1, "r")], accepted);
    expect(result.stale.map((entry) => entry.file)).toEqual(["b.ts", "gone.ts"]);
  });

  test("a line-specific entry does not cover another line", () => {
    const result = resolveGate([finding("a.ts", 2, "r")], accepted);
    expect(result.unexplained).toHaveLength(1);
  });
});

describe("normalizeOxlintRule", () => {
  test.each([
    ["eslint(no-console)", "no-console"],
    ["typescript-eslint(no-explicit-any)", "@typescript-eslint/no-explicit-any"],
    ["unicorn(no-null)", "unicorn/no-null"],
    ["react-hooks(rules-of-hooks)", "react-hooks/rules-of-hooks"],
    ["next(no-img-element)", "@next/next/no-img-element"],
    ["nextjs(no-img-element)", "@next/next/no-img-element"],
    ["jsx-a11y(alt-text)", "jsx-a11y/alt-text"],
    ["eslint-js(no-restricted-syntax)", "no-restricted-syntax"],
    ["shadcn(no-restyle)", "shadcn/no-restyle"],
    ["jsdoc(informative-docs)", "jsdoc/informative-docs"],
    ["jsdoc-js(informative-docs)", "jsdoc/informative-docs"],
    ["unicorn-js(no-for-each)", "unicorn/no-for-each"],
    ["jsx-a11y-js(no-redundant-roles)", "jsx-a11y/no-redundant-roles"],
    ["react-hooks-js(exhaustive-deps)", "react-hooks/exhaustive-deps"],
    ["astro-js(no-set-html-directive)", "astro/no-set-html-directive"],
    ["typescript-js(no-unused-vars)", "@typescript-eslint/no-unused-vars"],
    [
      "eslint-comments-js(no-duplicate-disable)",
      "@eslint-community/eslint-comments/no-duplicate-disable",
    ],
    ["local(require-description)", "@eslint-community/eslint-comments/require-description"],
    ["local(no-unused-enable)", "@eslint-community/eslint-comments/no-unused-enable"],
    ["local(no-non-doc-comments)", "local/no-non-doc-comments"],
    ["@eslint-react(no-missing-key)", "@eslint-react/no-missing-key"],
    ["no-bare-code", "no-bare-code"],
  ])("%s -> %s", (code, expected) => {
    expect(normalizeOxlintRule(code)).toBe(expected);
  });
});

describe("remapNativePorts", () => {
  const ports = new Map([
    ["@typescript-eslint/no-unused-expressions", "no-unused-expressions"],
    ["@typescript-eslint/array-type", "typescript/array-type"],
    ["unicorn/prefer-at", "unicorn/prefer-at"],
  ]);

  test("maps a native port reported under another id to its ESLint id", () => {
    expect(remapNativePorts([finding("a.ts", 1, "no-unused-expressions")], ports)).toEqual([
      finding("a.ts", 1, "@typescript-eslint/no-unused-expressions"),
    ]);
  });

  test("leaves ports whose ids already match and other rules untouched", () => {
    const findings = [
      finding("a.ts", 1, "@typescript-eslint/array-type"),
      finding("a.ts", 2, "unicorn/prefer-at"),
      finding("a.ts", 3, "no-console"),
    ];
    expect(remapNativePorts(findings, ports)).toEqual(findings);
  });
});

describe("linter output parsers", () => {
  test("parseEslintJson makes paths relative and keeps rule ids", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/src/a.ts",
        messages: [
          { ruleId: "no-console", line: 3 },
          { ruleId: null, line: 1 },
        ],
      },
    ]);
    expect(parseEslintJson(output, "/repo")).toEqual([finding("src/a.ts", 3, "no-console")]);
  });

  test("parseEslintJson throws on fatal messages instead of dropping the file", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/src/a.ts",
        messages: [{ ruleId: null, line: 1, fatal: true, message: "Parsing error" }],
      },
    ]);
    expect(() => parseEslintJson(output, "/repo")).toThrow("Parsing error");
  });

  test("parseEslintJson reads a directive naming an unknown rule as an unused directive", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/a.tsx",
        messages: [
          {
            ruleId: "@next/next/no-img-element",
            line: 3,
            message: "Definition for rule '@next/next/no-img-element' was not found.",
          },
        ],
      },
    ]);
    expect(parseEslintJson(output, "/repo")).toEqual([finding("a.tsx", 3, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseEslintJson keeps unused-directive reports under one pseudo rule", () => {
    const output = JSON.stringify([
      {
        filePath: "/repo/a.ts",
        messages: [
          {
            ruleId: null,
            line: 2,
            message: "Unused eslint-disable directive (no problems were reported from 'x').",
          },
        ],
      },
    ]);
    expect(parseEslintJson(output, "/repo")).toEqual([finding("a.ts", 2, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson maps unused-directive diagnostics to the pseudo rule", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: "",
          message: "Unused eslint-disable directive, no problems were reported",
          filename: "a.ts",
          labels: [{ span: { line: 2 } }],
        },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([finding("a.ts", 2, UNUSED_DIRECTIVE_RULE)]);
  });

  test("parseOxlintJson maps code-less unused-directive diagnostics to the pseudo rule", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          message: "Unused eslint-disable directive (no problems were reported).",
          filename: "a.ts",
          labels: [{ span: { line: 2 } }],
        },
        {
          message:
            "Unused eslint-enable directive (no matching eslint-disable directives were found for no-debugger).",
          filename: "a.ts",
          labels: [{ span: { line: 4 } }],
        },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([
      finding("a.ts", 2, UNUSED_DIRECTIVE_RULE),
      finding("a.ts", 4, UNUSED_DIRECTIVE_RULE),
    ]);
  });

  test("parseOxlintJson keeps an unrecognized code-less diagnostic visible", () => {
    const output = JSON.stringify({
      diagnostics: [{ message: "Something else", filename: "a.ts", labels: [] }],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([finding("a.ts", 0, OXLINT_UNCODED_RULE)]);
  });

  test("parseOxlintJson reads code, filename and first label line", () => {
    const output = JSON.stringify({
      diagnostics: [
        {
          code: "eslint(no-console)",
          filename: "src/a.ts",
          labels: [{ span: { line: 4 } }],
        },
        { code: "eslint(no-debugger)", filename: "src/b.ts", labels: [] },
      ],
    });
    expect(parseOxlintJson(output, "/repo")).toEqual([
      finding("src/a.ts", 4, "no-console"),
      finding("src/b.ts", 0, "no-debugger"),
    ]);
  });
});

test("findingKey is stable", () => {
  expect(findingKey(finding("a.ts", 1, "r"))).toBe("a.ts:1:r");
});
