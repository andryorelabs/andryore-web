import { defineConfig } from "oxlint";

import {
  BASELINE_TEST_FILE_GLOBS,
  OXLINT_BASELINE_RULES,
  OXLINT_BASELINE_TEST_RULES,
} from "./eslint-rules/oxlint-baseline.mjs";
import {
  OXLINT_BASE_RULES,
  OXLINT_IGNORE_PATTERNS,
  OXLINT_JS_PLUGINS,
  OXLINT_NATIVE_PLUGINS,
  OXLINT_OVERRIDES,
  OXLINT_SETTINGS,
} from "./eslint-rules/oxlint-rules.mjs";

/**
 * The repo's Oxlint config: every rule `eslint.config.mjs` applies to a
 * non-`.astro` file, with the same severity and options. The rule tables
 * live in `eslint-rules/oxlint-rules.mjs`, built from the same plugin
 * configs ESLint uses. Every category is off so nothing beyond them runs.
 * `bun run lint:oxlint` passes `--type-aware` (tsgolint) and
 * `--deny-warnings`, which gates `warn` like ESLint's `--max-warnings=0`.
 * On top, every rule of aokit's shared Oxlint baseline (standard rule E10,
 * `eslint-rules/oxlint-baseline.mjs`) is an error; the test-only baseline
 * rules apply to test files. `scripts/oxlint-baseline.test.ts` fails when a
 * baseline rule goes missing.
 */
export default defineConfig({
  plugins: OXLINT_NATIVE_PLUGINS,
  jsPlugins: OXLINT_JS_PLUGINS,
  env: { builtin: true },
  categories: {
    correctness: "off",
    nursery: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    suspicious: "off",
  },
  options: { reportUnusedDisableDirectives: "error" },
  settings: OXLINT_SETTINGS,
  rules: { ...OXLINT_BASE_RULES, ...OXLINT_BASELINE_RULES },
  overrides: [
    ...OXLINT_OVERRIDES,
    { files: BASELINE_TEST_FILE_GLOBS, rules: OXLINT_BASELINE_TEST_RULES },
  ],
  ignorePatterns: OXLINT_IGNORE_PATTERNS,
});
