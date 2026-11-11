import { describe, expect, test } from "bun:test";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { Linter } from "eslint";
import unicorn from "eslint-plugin-unicorn";

import localPlugin from "./index.mjs";

const PORTED_RULES = [
  "require-description",
  "no-unlimited-disable",
  "no-unused-enable",
  "no-aggregating-enable",
  "disable-enable-pair",
] as const;

type PortedRule = (typeof PORTED_RULES)[number];

const linter = new Linter({ configType: "flat" });

function findings(code: string, plugin: "original" | "local", rule: PortedRule): string[] {
  const ruleId =
    plugin === "original" ? `@eslint-community/eslint-comments/${rule}` : `local/${rule}`;
  const messages = linter.verify(code, {
    plugins: {
      "@eslint-community/eslint-comments": eslintComments,
      local: localPlugin,
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: { [ruleId]: "error" },
  });
  return messages.map((message) => `${String(message.line)}: ${message.message}`);
}

const SOURCES: Record<string, string> = {
  "described directives": [
    "/* eslint-disable no-console -- logs on purpose */",
    "console.info(1)",
    "/* eslint-enable no-console -- back to normal */",
    "// eslint-disable-next-line no-alert -- legacy prompt",
    "alert(1)",
  ].join("\n"),
  "undescribed directives of every kind": [
    "export const start = 1",
    "/* eslint-disable no-console */",
    "console.info(1)",
    "/* eslint-enable no-console */",
    "// eslint-disable-next-line no-alert",
    "alert(1)",
    "alert(2) // eslint-disable-line no-alert",
    "/* global window */",
    '/* eslint no-console: "off" */',
  ].join("\n"),
  "an unlimited next-line disable": [
    "export const start = 1",
    "// eslint-disable-next-line -- every rule",
    "alert(1)",
  ].join("\n"),
  "enables that re-enable nothing": [
    "export const start = 1",
    "/* eslint-disable no-console -- reason */",
    "console.info(1)",
    "/* eslint-enable no-console -- closes it */",
    "/* eslint-enable no-console -- closes nothing */",
    "/* eslint-enable no-alert, no-console -- closes nothing */",
    "/* eslint-enable -- closes nothing */",
  ].join("\n"),
  "an enable closing several disables": [
    "export const start = 1",
    "/* eslint-disable no-console -- one */",
    "/* eslint-disable no-alert -- two */",
    "console.info(1)",
    "/* eslint-enable -- closes both */",
    "/* eslint-disable no-console, no-alert -- one comment */",
    "/* eslint-enable -- closes one comment */",
  ].join("\n"),
  "unclosed disables": [
    "export const start = 1",
    "/* eslint-disable no-console -- never closed */",
    "/* eslint-disable no-alert, no-debugger -- half closed */",
    "/* eslint-enable no-alert -- closes one */",
    "console.info(1)",
  ].join("\n"),
  "a line disable a block enable cannot close": [
    "export const start = 1",
    "alert(1) // eslint-disable-line no-alert -- legacy",
    "/* eslint-enable no-alert -- closes nothing */",
  ].join("\n"),
  "prose that only mentions eslint": [
    "// eslint is not configured in this snippet",
    "export const value = 1",
  ].join("\n"),
};

describe("local directive-comment rules report exactly what the originals report under ESLint", () => {
  for (const [name, code] of Object.entries(SOURCES)) {
    for (const rule of PORTED_RULES) {
      test(`${rule}: ${name}`, () => {
        expect(findings(code, "local", rule)).toEqual(findings(code, "original", rule));
      });
    }
  }
});

describe("known gap: a bare disable hides the port report on its own line", () => {
  const sources = [
    "export const a = 1\nalert(1) // eslint-disable-line -- every rule",
    "export const a = 1\n/* eslint-disable -- every rule */\nalert(1)",
  ];

  for (const code of sources) {
    test(`unicorn/no-abusive-eslint-disable still reports ${JSON.stringify(code)}`, () => {
      expect(findings(code, "local", "no-unlimited-disable")).toEqual([]);
      expect(findings(code, "original", "no-unlimited-disable")).toHaveLength(1);
      const messages = linter.verify(code, {
        plugins: { unicorn },
        linterOptions: { reportUnusedDisableDirectives: "off" },
        rules: { "unicorn/no-abusive-eslint-disable": "error" },
      });
      expect(messages.map((message) => message.ruleId)).toEqual([
        "unicorn/no-abusive-eslint-disable",
      ]);
    });
  }
});

describe("the ports also police Oxlint directives", () => {
  test("require-description reports an undescribed oxlint-disable-next-line", () => {
    expect(
      findings(
        "export const a = 1\n// oxlint-disable-next-line no-alert\nalert(1)",
        "local",
        "require-description",
      ),
    ).toHaveLength(1);
  });

  test("no-unlimited-disable reports a bare oxlint-disable-line", () => {
    expect(
      findings(
        "export const a = 1\nalert(1) // oxlint-disable-line -- every rule",
        "local",
        "no-unlimited-disable",
      ),
    ).toHaveLength(1);
  });

  test("no-unused-enable reports an oxlint-enable that closes nothing", () => {
    expect(
      findings(
        "export const a = 1\n/* oxlint-enable no-alert -- nothing open */",
        "local",
        "no-unused-enable",
      ),
    ).toEqual(["2: 'no-alert' rule is re-enabled but it has not been disabled."]);
  });
});
