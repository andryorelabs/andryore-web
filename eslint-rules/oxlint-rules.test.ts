import { describe, expect, test } from "bun:test";
import path from "node:path";
import { ESLint } from "eslint";

import oxlintConfig from "../oxlint.config";
import {
  ESLINT_PATH_BLOCKS,
  NATIVE_PORTS,
  OXLINT_BASE_RULES,
  OXLINT_IGNORE_PATTERNS,
  OXLINT_JS_PLUGINS,
  OXLINT_OVERRIDES,
  toOxlintRuleId,
} from "./oxlint-rules.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const REPRESENTATIVE_FILES = [
  "src/lib/about.ts",
  "src/lib/about.test.ts",
  "src/components/Dock.tsx",
  "src/components/ui/button.tsx",
  "eslint-rules/index.mjs",
  "astro.config.mjs",
];

const SEVERITY: Record<string, number> = { off: 0, warn: 1, error: 2 };

function normalizeValue(value: unknown): unknown[] {
  const parts: unknown[] = Array.isArray(value) ? (value as unknown[]) : [value];
  const [severity, ...options] = parts;
  return [typeof severity === "string" ? SEVERITY[severity] : severity, ...options];
}

function isEnabled(value: unknown): boolean {
  return normalizeValue(value)[0] !== 0;
}

function isMatchingAny(file: string, globs: readonly string[]): boolean {
  return globs.some((glob) => new Bun.Glob(glob).match(file));
}

/**
 * The rules Oxlint enables for a file: the base rules, then every matching
 * override in order, a later value replacing an earlier one.
 * @param file A repo-relative path.
 * @returns The enabled rules with numeric severities.
 */
function resolveOxlintRules(file: string): Map<string, unknown[]> {
  const resolved: Record<string, unknown> = { ...OXLINT_BASE_RULES };
  for (const override of OXLINT_OVERRIDES) {
    if (isMatchingAny(file, override.files)) Object.assign(resolved, override.rules);
  }
  return new Map(
    Object.entries(resolved)
      .filter(([, value]) => isEnabled(value))
      .map(([ruleId, value]) => [ruleId, normalizeValue(value)]),
  );
}

async function resolveEslintRules(file: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const config = (await eslint.calculateConfigForFile(file)) as
    | { rules?: Record<string, unknown> }
    | undefined;
  return Object.entries(config?.rules ?? {})
    .filter(([, value]) => isEnabled(value))
    .map(([ruleId]) => ruleId);
}

const EXPECTED_OXLINT_RULES: Record<string, { enabled: string[]; disabled: string[] }> = {
  "src/lib/about.ts": {
    enabled: [
      "typescript/no-floating-promises",
      "unicorn-js/prefer-ternary",
      "local/no-non-doc-comments",
      "local/require-description",
      "jsdoc-js/require-param",
    ],
    disabled: ["eslint-js/no-restricted-syntax", "shadcn/no-raw-colors"],
  },
  "src/lib/about.test.ts": {
    enabled: ["eslint-js/no-restricted-syntax", "typescript/no-floating-promises"],
    disabled: ["shadcn/no-raw-colors"],
  },
  "src/components/Dock.tsx": {
    enabled: ["shadcn/no-restyle", "shadcn/no-raw-colors", "react-hooks-js/rules-of-hooks"],
    disabled: [],
  },
  "src/components/ui/button.tsx": {
    enabled: ["shadcn/no-raw-colors"],
    disabled: ["shadcn/no-restyle"],
  },
  "eslint-rules/index.mjs": {
    enabled: ["local/no-non-doc-comments", "jsdoc-js/require-param"],
    disabled: ["shadcn/no-raw-colors"],
  },
  "astro.config.mjs": {
    enabled: ["local/no-non-doc-comments"],
    disabled: ["unicorn-js/no-top-level-side-effects"],
  },
};

describe("Oxlint enforces the rules each representative file needs", () => {
  for (const file of REPRESENTATIVE_FILES) {
    test(file, () => {
      const oxlintRules = resolveOxlintRules(file);
      const enabled = EXPECTED_OXLINT_RULES[file]?.enabled ?? [];
      const disabled = EXPECTED_OXLINT_RULES[file]?.disabled ?? [];
      for (const ruleId of enabled) {
        expect(oxlintRules.has(ruleId)).toBe(true);
      }
      for (const ruleId of disabled) {
        expect(oxlintRules.has(ruleId)).toBe(false);
      }
    });
  }
});

describe("ESLint lints .astro files and nothing else", () => {
  test("applies no rule to a TypeScript file", async () => {
    expect(await resolveEslintRules("src/lib/about.ts")).toEqual([]);
  });

  test("applies the script block rules to a TypeScript child of an Astro component", async () => {
    const rules = await resolveEslintRules("src/components/AboutPage.astro/1_1.ts");
    for (const ruleId of [
      "local/no-non-doc-comments",
      "unicorn/no-for-each",
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/consistent-type-imports",
      "jsdoc/require-param",
      "@eslint-community/eslint-comments/require-description",
    ]) {
      expect(rules).toContain(ruleId);
    }
    expect(rules).not.toContain("@typescript-eslint/no-floating-promises");
  });

  test("applies only the shared rules to a JavaScript child of an Astro component", async () => {
    const rules = await resolveEslintRules("src/components/AboutPage.astro/1_1.js");
    expect(rules).toContain("unicorn/no-for-each");
    expect(rules).not.toContain("local/no-non-doc-comments");
    expect(rules).not.toContain("@typescript-eslint/no-explicit-any");
  });

  test("applies the astro, unicorn and local rules to an Astro component", async () => {
    const rules = await resolveEslintRules("src/components/AboutPage.astro");
    expect(rules).toContain("local/no-non-doc-comments");
    expect(rules).toContain("unicorn/filename-case");
    expect(rules.some((ruleId) => ruleId.startsWith("astro/"))).toBe(true);
    expect(rules.some((ruleId) => ruleId.startsWith("@typescript-eslint/"))).toBe(false);
    expect(rules.some((ruleId) => ruleId.startsWith("jsdoc/"))).toBe(false);
  });
});

describe("toOxlintRuleId", () => {
  test("sends type-aware typescript-eslint rules to tsgolint", () => {
    expect(toOxlintRuleId("@typescript-eslint/no-floating-promises")).toBe(
      "typescript/no-floating-promises",
    );
  });

  test("uses a proven native port", () => {
    expect(toOxlintRuleId("@typescript-eslint/consistent-type-imports")).toBe(
      "typescript/consistent-type-imports",
    );
    expect(toOxlintRuleId("prefer-const")).toBe("prefer-const");
  });

  test("runs a rule without a proven native port on its original engine", () => {
    expect(toOxlintRuleId("unicorn/prefer-ternary")).toBe("unicorn-js/prefer-ternary");
    expect(toOxlintRuleId("no-restricted-syntax")).toBe("eslint-js/no-restricted-syntax");
    expect(toOxlintRuleId("@typescript-eslint/no-unused-vars")).toBe(
      "typescript-js/no-unused-vars",
    );
  });

  test("sends the misreporting eslint-comments rules to the local ports", () => {
    expect(toOxlintRuleId("@eslint-community/eslint-comments/require-description")).toBe(
      "local/require-description",
    );
    expect(toOxlintRuleId("@eslint-community/eslint-comments/no-duplicate-disable")).toBe(
      "eslint-comments-js/no-duplicate-disable",
    );
  });

  test("rejects a rule from an unmapped plugin", () => {
    expect(() => toOxlintRuleId("react/jsx-key")).toThrow("No Oxlint engine is mapped");
  });
});

describe("the Oxlint config", () => {
  test("reports unused disable directives as errors", () => {
    expect(oxlintConfig.options.reportUnusedDisableDirectives).toBe("error");
  });

  test("loads every JS plugin a rule id names", () => {
    const loaded = new Set(
      OXLINT_JS_PLUGINS.map((plugin) => (typeof plugin === "string" ? plugin : plugin.name)),
    );
    const native = new Set(["typescript", "unicorn", "jsx-a11y"]);
    const ruleIds = [OXLINT_BASE_RULES, ...OXLINT_OVERRIDES.map((o) => o.rules)]
      .flatMap((rules) => Object.keys(rules ?? {}))
      .filter((ruleId) => ruleId.includes("/"));
    for (const ruleId of ruleIds) {
      const plugin = ruleId.slice(0, ruleId.lastIndexOf("/"));
      expect(loaded.has(plugin) || native.has(plugin)).toBe(true);
    }
  });

  test("maps every native port to a native plugin the config enables", () => {
    const enabled = new Set<string>(oxlintConfig.plugins);
    for (const nativeId of NATIVE_PORTS.values()) {
      const plugin = nativeId.includes("/")
        ? nativeId.slice(0, nativeId.lastIndexOf("/"))
        : "eslint";
      expect(enabled.has(plugin)).toBe(true);
    }
  });

  test("ports the single-source policy blocks", () => {
    const testBlock = ESLINT_PATH_BLOCKS.find((block) => block.files.includes("**/*.test.ts"));
    expect(testBlock?.rules["no-restricted-syntax"]).toBeArray();
    const uiBlock = OXLINT_OVERRIDES.find((override) =>
      override.files.includes("src/components/ui/**"),
    );
    expect(uiBlock?.rules).toEqual({ "shadcn/no-restyle": "off" });
  });

  test("leaves .astro files to ESLint and keeps its global ignores", () => {
    expect(OXLINT_IGNORE_PATTERNS).toContain("**/*.astro");
    expect(OXLINT_IGNORE_PATTERNS).toContain("parity/fixtures/**");
  });
});

function hasNoNull(file: string): boolean {
  return resolveOxlintRules(file).has("unicorn-js/no-null");
}

describe("design-choice rules", () => {
  test("enables the four rules in Oxlint with the API-mandated names only", () => {
    expect(OXLINT_BASE_RULES["unicorn-js/no-null"]).toBe("error");
    expect(OXLINT_BASE_RULES["unicorn-js/consistent-boolean-name"]).toBe("error");
    expect(OXLINT_BASE_RULES["unicorn-js/single-line-block-comment-style"]).toBe("error");
    expect(OXLINT_BASE_RULES["unicorn-js/name-replacements"]).toEqual([
      "error",
      { allowList: { props: true, Props: true, ref: true, Ref: true } },
    ]);
  });

  test("keeps the asterisk-prefix rule off", () => {
    expect(
      OXLINT_BASE_RULES["unicorn-js/no-asterisk-prefix-in-documentation-comments"],
    ).toBeUndefined();
  });

  test("turns no-null off for tests and end-to-end specs only", () => {
    expect(hasNoNull("src/lib/motion.ts")).toBe(true);
    expect(hasNoNull("src/lib/motion.test.ts")).toBe(false);
    expect(hasNoNull("scripts/check.test.mjs")).toBe(false);
    expect(hasNoNull("e2e/helpers.ts")).toBe(false);
    expect(hasNoNull("e2e/home.spec.ts")).toBe(false);
  });
});

describe("hexadecimal literal case", () => {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const filePath = path.join(REPO_ROOT, "src/components/Hex.astro/1_1.js");

  async function reportedRules(code: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return (result?.messages ?? []).map((message) => message.ruleId ?? "");
  }

  test("both engines require lowercase digits, as Oxfmt writes them", async () => {
    expect(OXLINT_BASE_RULES[toOxlintRuleId("unicorn/number-literal-case")]).toEqual([
      "error",
      { hexadecimalValue: "lowercase" },
    ]);
    expect(await reportedRules("export const x = 0xABCDEF\n")).toContain(
      "unicorn/number-literal-case",
    );
    expect(await reportedRules("export const x = 0xabcdef\n")).not.toContain(
      "unicorn/number-literal-case",
    );
  });

  test("Oxfmt writes hexadecimal digits in lowercase", async () => {
    const proc = Bun.spawn(["bunx", "oxfmt", "--stdin-filepath", "hex.ts"], {
      cwd: REPO_ROOT,
      stdin: new Blob(["export const x = 0xABCDEF\n"]),
      stdout: "pipe",
    });
    expect(await new Response(proc.stdout).text()).toContain("0xabcdef");
  });
});
