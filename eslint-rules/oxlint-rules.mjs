import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import eslintReact from "@eslint-react/eslint-plugin";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import { shadcnNoRestyleContracts, UNAWAITED_ASYNC_MATCHER_SELECTORS } from "./policy.mjs";

/**
 * The ESLint plugins Oxlint loads as JS plugins, so a rule runs on its
 * original ESLint engine. Oxlint reserves its native plugin names
 * (`unicorn`, `jsdoc`, `jsx-a11y`, `react`, `typescript`, `eslint`), so the
 * originals of those load under a `-js` alias. `eslint-js` is
 * `oxlint-plugin-eslint`, ESLint's core rules packaged as a plugin.
 */
export const OXLINT_JS_PLUGINS = [
  { name: "local", specifier: "./eslint-rules/index.mjs" },
  { name: "shadcn", specifier: "@shadcn/lint" },
  { name: "eslint-js", specifier: "oxlint-plugin-eslint" },
  { name: "unicorn-js", specifier: "eslint-plugin-unicorn" },
  { name: "jsdoc-js", specifier: "eslint-plugin-jsdoc" },
  { name: "jsx-a11y-js", specifier: "eslint-plugin-jsx-a11y" },
  { name: "astro-js", specifier: "eslint-plugin-astro" },
  { name: "typescript-js", specifier: "./eslint-rules/typescript-eslint.mjs" },
  { name: "@eslint-react", specifier: "@eslint-react/eslint-plugin" },
  { name: "react-hooks-js", specifier: "eslint-plugin-react-hooks" },
  {
    name: "eslint-comments-js",
    specifier: "@eslint-community/eslint-plugin-eslint-comments",
  },
];

/**
 * Oxlint plugin name for each ESLint plugin namespace whose rules run on
 * their original engine. The key `''` stands for ESLint's core rules.
 */
const JS_PLUGIN_BY_NAMESPACE = {
  "": "eslint-js",
  "@typescript-eslint": "typescript-js",
  "@eslint-community/eslint-comments": "eslint-comments-js",
  "@eslint-react": "@eslint-react",
  astro: "astro-js",
  jsdoc: "jsdoc-js",
  "jsx-a11y": "jsx-a11y-js",
  local: "local",
  "react-hooks": "react-hooks-js",
  shadcn: "shadcn",
  unicorn: "unicorn-js",
};

/**
 * ESLint rules that run as a native Oxlint port, each mapped to the native
 * id. A rule is listed only once its port is proven to report exactly what
 * the original reports with the same options; every other rule runs on its
 * original engine through a JS plugin.
 */
export const NATIVE_PORTS = new Map([
  ...[
    "alt-text",
    "anchor-has-content",
    "click-events-have-key-events",
    "heading-has-content",
    "no-autofocus",
    "no-static-element-interactions",
  ].map((name) => [`jsx-a11y/${name}`, `jsx-a11y/${name}`]),
  ...[
    "catch-error-name",
    "consistent-existence-index-check",
    "error-message",
    "explicit-length-check",
    "import-style",
    "new-for-builtins",
    "no-abusive-eslint-disable",
    "no-array-reduce",
    "no-array-sort",
    "no-negated-condition",
    "no-thenable",
    "no-useless-spread",
    "numeric-separators-style",
    "prefer-at",
    "prefer-date-now",
    "prefer-node-protocol",
    "prefer-number-coercion",
    "prefer-object-from-entries",
    "prefer-optional-catch-binding",
    "prefer-query-selector",
    "prefer-response-static-json",
    "prefer-set-has",
    "prefer-spread",
    "prefer-string-slice",
    "require-module-specifiers",
    "switch-case-braces",
  ].map((name) => [`unicorn/${name}`, `unicorn/${name}`]),
  ["no-var", "no-var"],
  ["prefer-const", "prefer-const"],
  ...[
    "array-type",
    "ban-ts-comment",
    "consistent-generic-constructors",
    "consistent-type-assertions",
    "consistent-type-definitions",
    "consistent-type-imports",
    "no-dynamic-delete",
    "no-explicit-any",
    "no-inferrable-types",
    "no-invalid-void-type",
    "no-non-null-asserted-optional-chain",
    "no-non-null-assertion",
  ].map((name) => [`@typescript-eslint/${name}`, `typescript/${name}`]),
  ["@typescript-eslint/no-unused-expressions", "no-unused-expressions"],
]);

/**
 * `@eslint-community/eslint-comments` rules that run as the local ports in
 * `directive-comments.mjs`: under Oxlint the originals report on the wrong
 * line or crash with a RangeError (oxc#23330). `no-duplicate-disable`
 * reports correctly and keeps the original.
 */
const LOCAL_DIRECTIVE_RULES = new Set([
  "disable-enable-pair",
  "no-aggregating-enable",
  "no-unlimited-disable",
  "no-unused-enable",
  "require-description",
]);

/**
 * The native Oxlint plugins `NATIVE_PORTS` and tsgolint rules need. Every
 * category is off, so enabling a plugin runs none of its other rules.
 */
export const OXLINT_NATIVE_PLUGINS = ["eslint", "typescript", "unicorn", "jsx-a11y"];

/**
 * typescript-eslint rules that need type information. They run on tsgolint
 * (`oxlint --type-aware`), the only engine that gives a rule a type checker
 * under Oxlint.
 */
const TYPE_AWARE_TYPESCRIPT_RULES = new Set(
  Object.entries(tseslint.plugin.rules)
    .filter(([, rule]) => rule.meta.docs?.requiresTypeChecking === true)
    .map(([name]) => name),
);

/**
 * Splits an ESLint rule id into its plugin namespace (`''` for core rules)
 * and its rule name.
 * @param ruleId An ESLint rule id such as `unicorn/no-null` or `no-var`.
 * @returns The namespace and the rule name.
 */
function splitRuleId(ruleId) {
  const slash = ruleId.lastIndexOf("/");
  return slash === -1
    ? { namespace: "", name: ruleId }
    : { namespace: ruleId.slice(0, slash), name: ruleId.slice(slash + 1) };
}

/**
 * Maps an ESLint rule id to the Oxlint rule id that enforces it: tsgolint
 * for type-aware typescript-eslint rules, a proven native port, or the
 * original rule under its JS plugin alias.
 * @param ruleId An ESLint rule id such as `@typescript-eslint/no-unused-vars`.
 * @returns The id Oxlint runs it under, such as `typescript-js/no-unused-vars`.
 */
export function toOxlintRuleId(ruleId) {
  const { namespace, name } = splitRuleId(ruleId);
  if (namespace === "@typescript-eslint" && TYPE_AWARE_TYPESCRIPT_RULES.has(name)) {
    return `typescript/${name}`;
  }
  const nativeId = NATIVE_PORTS.get(ruleId);
  if (nativeId !== undefined) return nativeId;
  if (namespace === "@eslint-community/eslint-comments" && LOCAL_DIRECTIVE_RULES.has(name)) {
    return `local/${name}`;
  }
  const plugin = JS_PLUGIN_BY_NAMESPACE[namespace];
  if (plugin === undefined) {
    throw new Error(`No Oxlint engine is mapped for ESLint rule ${ruleId}`);
  }
  return `${plugin}/${name}`;
}

/**
 * Reports whether an ESLint rule value turns the rule off.
 * @param value A rule value: a severity or a `[severity, ...options]` array.
 * @returns Whether the severity is `off` or `0`.
 */
function isOff(value) {
  const severity = Array.isArray(value) ? value[0] : value;
  return severity === "off" || severity === 0;
}

/**
 * Translates an ESLint rule map to Oxlint ids, keeping each value (severity
 * and options) untouched. One kind of entry is left out because it
 * changes nothing under ESLint either: `off` entries for rules no block enables (such as
 * `@typescript-eslint/naming-convention`, which tsgolint does not port).
 * @param rules An ESLint `rules` object.
 * @returns The same rules under their Oxlint ids.
 */
function toOxlintRules(rules) {
  return Object.fromEntries(
    Object.entries(rules)
      .filter(([ruleId, value]) => !isOff(value) || ENABLED_RULE_IDS.has(ruleId))
      .map(([ruleId, value]) => [toOxlintRuleId(ruleId), value]),
  );
}

/**
 * Merges the `rules` of every block in a list of ESLint flat configs, later
 * blocks winning, the way `extends` composes them.
 * @param configs ESLint flat config blocks.
 * @returns The merged rules.
 */
function mergeRules(configs) {
  return Object.assign({}, ...configs.map((config) => config.rules ?? {}));
}

/**
 * Names `unicorn/name-replacements` keeps, each required by an external API
 * so renaming it would break the contract:
 * - `props` and `Props`: the Astro and React component contract (`Astro.props`
 *   and the `Props` interface Astro reads to type a component).
 * - `ref` and `Ref`: `@eslint-react` `naming-convention-ref-name` requires every
 *   `useRef` identifier to be `ref` or to end in `Ref`.
 */
const NAME_REPLACEMENT_ALLOW_LIST = {
  props: true,
  Props: true,
  ref: true,
  Ref: true,
};

/**
 * Rules `eslint.config.mjs` applies to every file it lints: jsx-a11y and
 * unicorn `recommended` with the repo's overrides, and the rules of the
 * global `astro/recommended` block (the other `astro` blocks only match
 * `.astro` files, which stay on ESLint).
 */
const GLOBAL_RULES = {
  ...jsxA11y.flatConfigs.recommended.rules,
  ...unicorn.configs.recommended.rules,
  "unicorn/number-literal-case": ["error", { hexadecimalValue: "lowercase" }],
  "unicorn/name-replacements": ["error", { allowList: NAME_REPLACEMENT_ALLOW_LIST }],
  "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
  "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
  ...mergeRules(astro.configs.recommended.filter((config) => !config.files)),
};

/**
 * typescript-eslint's `strictTypeChecked` + `stylisticTypeChecked` plus the repo's TypeScript overrides.
 */
const TYPESCRIPT_RULES = {
  ...mergeRules(tseslint.configs.strictTypeChecked),
  ...mergeRules(tseslint.configs.stylisticTypeChecked),
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/await-thenable": "error",
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  "@typescript-eslint/no-deprecated": "warn",
};

/**
 * `eslint-plugin-jsdoc`'s TypeScript recommended rules as `eslint.config.mjs` tunes them, plus `eslint-comments` and the local rule.
 */
const DOCUMENTED_SOURCE_RULES = {
  ...jsdoc.configs["flat/recommended-typescript-error"].rules,
  "jsdoc/require-jsdoc": "off",
  "jsdoc/informative-docs": "error",
  ...eslintComments.configs.recommended.rules,
  "@eslint-community/eslint-comments/require-description": "error",
  "local/no-non-doc-comments": "error",
};

/**
 * `typescript-eslint/disable-type-checked`'s rules.
 */
const DISABLE_TYPE_CHECKED_RULES = tseslint.configs.disableTypeChecked.rules;

/**
 * Files that hold React islands and the shadcn/ui components they use.
 */
const ISLAND_FILES = ["src/**/*.tsx"];

/**
 * The repo's React island rules: `@eslint-react` `recommended-typescript`
 * and React Hooks `recommended`.
 */
const ISLAND_RULES = {
  ...eslintReact.configs["recommended-typescript"].rules,
  ...reactHooks.configs.flat.recommended.rules,
};

/**
 * The six `@shadcn/lint` rules, with the single-source `no-restyle` contracts.
 */
const SHADCN_RULES = {
  "shadcn/no-restyle": ["error", { allow: ["layout"], contracts: shadcnNoRestyleContracts }],
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": "error",
  "shadcn/no-inline-styles": "error",
  "shadcn/no-unknown-classes": "error",
  "shadcn/require-static-classes": "error",
};

/**
 * Files where `unicorn/no-null` is off: tests and end-to-end specs assert
 * against platform and library contracts that return `null` (DOM queries, Web
 * Storage, `JSON.parse`, Playwright), and pass raw `null` input on purpose.
 */
const NULL_ALLOWED_FILES = ["**/*.{test,spec}.{ts,tsx,mjs}", "e2e/**"];

/**
 * Every path-scoped, non-`.astro` block of `eslint.config.mjs`, in the same
 * order and still in ESLint rule ids. The `.astro`-only blocks are left out:
 * those files stay on ESLint.
 */
export const ESLINT_PATH_BLOCKS = [
  { files: ["**/*.{ts,tsx}"], rules: TYPESCRIPT_RULES },
  {
    files: ["**/*.config.{ts,mjs}"],
    rules: { "unicorn/no-top-level-side-effects": "off" },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...UNAWAITED_ASYNC_MATCHER_SELECTORS],
    },
  },
  { files: NULL_ALLOWED_FILES, rules: { "unicorn/no-null": "off" } },
  { files: ["**/*.{ts,tsx,mjs}"], rules: DOCUMENTED_SOURCE_RULES },
  { files: ["**/*.{js,mjs,cjs}"], rules: DISABLE_TYPE_CHECKED_RULES },
  {
    files: [".github/ISSUE_TEMPLATE/**"],
    rules: { "unicorn/filename-case": "off" },
  },
  { files: ISLAND_FILES, rules: ISLAND_RULES },
  { files: ISLAND_FILES, rules: SHADCN_RULES },
  {
    files: ["src/components/ui/**"],
    rules: { "shadcn/no-restyle": "off" },
  },
  { files: ["parity/.corpus/**"], rules: DISABLE_TYPE_CHECKED_RULES },
];

/**
 * Every ESLint rule id that the global rules or some path block enables.
 */
const ENABLED_RULE_IDS = new Set(
  [GLOBAL_RULES, ...ESLINT_PATH_BLOCKS.map((block) => block.rules)].flatMap((rules) =>
    Object.entries(rules)
      .filter(([, value]) => !isOff(value))
      .map(([ruleId]) => ruleId),
  ),
);

/**
 * Rules Oxlint applies to every file, in Oxlint ids.
 */
export const OXLINT_BASE_RULES = toOxlintRules(GLOBAL_RULES);

/**
 * Oxlint's port of `ESLINT_PATH_BLOCKS`, in the same order: like flat
 * config, a later override replaces an earlier one's value for the same
 * rule.
 */
export const OXLINT_OVERRIDES = ESLINT_PATH_BLOCKS.map((block) => ({
  files: block.files,
  rules: toOxlintRules(block.rules),
}));

/**
 * Plugin settings the ported rules read: `@eslint-react`'s `react-x`
 * settings from its `recommended-typescript` config.
 */
export const OXLINT_SETTINGS = {
  ...eslintReact.configs["recommended-typescript"].settings,
};

/**
 * What Oxlint never lints: `.astro` files (they stay on ESLint until
 * oxc#23207 lets JS plugins see the template), ESLint's global ignores, and
 * the extensions ESLint does not lint here (`.mts`, `.cts`, `.jsx`). The
 * parity corpus is linted only when `PARITY_CORPUS=1`.
 */
export const OXLINT_IGNORE_PATTERNS = [
  "**/*.astro",
  "**/*.{mts,cts,jsx}",
  "**/.astro/**",
  "**/dist/**",
  "**/coverage/**",
  ".claude/**",
  ".agents/**",
  ".forge/**",
  "parity/fixtures/**",
  ...(process.env.PARITY_CORPUS === "1" ? [] : ["parity/.corpus/**"]),
];
