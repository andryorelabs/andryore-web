/**
 * Every rule of the typescript-eslint `strictTypeChecked` preset that Oxlint
 * implements, copied from aokit's Oxlint baseline (standard rule E10).
 * Extension rules that Oxlint ships under the `eslint` scope are listed
 * under that scope.
 */
const STRICT_TYPE_CHECKED_RULES = [
  "typescript/await-thenable",
  "typescript/ban-ts-comment",
  "eslint/no-array-constructor",
  "typescript/no-array-delete",
  "typescript/no-base-to-string",
  "typescript/no-confusing-void-expression",
  "typescript/no-deprecated",
  "typescript/no-duplicate-enum-values",
  "typescript/no-duplicate-type-constituents",
  "typescript/no-dynamic-delete",
  "typescript/no-empty-object-type",
  "typescript/no-explicit-any",
  "typescript/no-extra-non-null-assertion",
  "typescript/no-extraneous-class",
  "typescript/no-floating-promises",
  "typescript/no-for-in-array",
  "typescript/no-implied-eval",
  "typescript/no-invalid-void-type",
  "typescript/no-meaningless-void-operator",
  "typescript/no-misused-new",
  "typescript/no-misused-promises",
  "typescript/no-misused-spread",
  "typescript/no-mixed-enums",
  "typescript/no-namespace",
  "typescript/no-non-null-asserted-nullish-coalescing",
  "typescript/no-non-null-asserted-optional-chain",
  "typescript/no-non-null-assertion",
  "typescript/no-redundant-type-constituents",
  "typescript/no-require-imports",
  "typescript/no-this-alias",
  "typescript/no-unnecessary-boolean-literal-compare",
  "typescript/no-unnecessary-condition",
  "typescript/no-unnecessary-template-expression",
  "typescript/no-unnecessary-type-arguments",
  "typescript/no-unnecessary-type-assertion",
  "typescript/no-unnecessary-type-conversion",
  "typescript/no-useless-default-assignment",
  "typescript/no-unsafe-enum-assignment",
  "typescript/no-generated-empty-object-type",
  "typescript/no-unnecessary-type-constraint",
  "typescript/no-unnecessary-type-parameters",
  "typescript/no-unsafe-argument",
  "typescript/no-unsafe-assignment",
  "typescript/no-unsafe-call",
  "typescript/no-unsafe-declaration-merging",
  "typescript/no-unsafe-enum-comparison",
  "typescript/no-unsafe-function-type",
  "typescript/no-unsafe-member-access",
  "typescript/no-unsafe-return",
  "typescript/no-unsafe-unary-minus",
  "eslint/no-unused-expressions",
  "eslint/no-unused-vars",
  "eslint/no-useless-constructor",
  "typescript/no-wrapper-object-types",
  "typescript/only-throw-error",
  "typescript/prefer-as-const",
  "typescript/prefer-literal-enum-member",
  "typescript/prefer-namespace-keyword",
  "typescript/prefer-promise-reject-errors",
  "typescript/prefer-reduce-type-parameter",
  "typescript/prefer-return-this-type",
  "typescript/related-getter-setter-pairs",
  "typescript/require-await",
  "typescript/restrict-plus-operands",
  "typescript/restrict-template-expressions",
  "typescript/return-await",
  "typescript/triple-slash-reference",
  "typescript/unbound-method",
  "typescript/unified-signatures",
  "typescript/use-unknown-in-catch-callback-variable",
];

/**
 * Every rule of the typescript-eslint `stylisticTypeChecked` preset that
 * Oxlint implements.
 */
const STYLISTIC_TYPE_CHECKED_RULES = [
  "typescript/adjacent-overload-signatures",
  "typescript/array-type",
  "typescript/ban-tslint-comment",
  "typescript/class-literal-property-style",
  "typescript/consistent-generic-constructors",
  "typescript/consistent-indexed-object-style",
  "typescript/consistent-type-assertions",
  "typescript/consistent-type-definitions",
  "typescript/dot-notation",
  "typescript/no-confusing-non-null-assertion",
  "eslint/no-empty-function",
  "typescript/no-inferrable-types",
  "typescript/non-nullable-type-assertion-style",
  "typescript/prefer-find",
  "typescript/prefer-for-of",
  "typescript/prefer-function-type",
  "typescript/prefer-includes",
  "typescript/prefer-nullish-coalescing",
  "typescript/prefer-optional-chain",
  "typescript/prefer-regexp-exec",
  "typescript/prefer-string-starts-ends-with",
];

/**
 * The JSDoc content rules: tags are known, tag bodies are present where
 * needed and absent where not, and defaults live in code, not in prose.
 */
const JSDOC_CONTENT_RULES = [
  "jsdoc/check-tag-names",
  "jsdoc/empty-tags",
  "jsdoc/implements-on-classes",
  "jsdoc/no-defaults",
  "jsdoc/require-param-name",
  "jsdoc/require-property-name",
  "jsdoc/require-returns-description",
];

/**
 * The baseline rule names Oxlint applies to every file, deduplicated.
 */
const BASELINE_RULE_NAMES = [
  ...new Set([
    ...STRICT_TYPE_CHECKED_RULES,
    ...STYLISTIC_TYPE_CHECKED_RULES,
    "typescript/switch-exhaustiveness-check",
    "typescript/no-explicit-any",
    "typescript/return-await",
    "typescript/consistent-type-imports",
    "typescript/no-unnecessary-condition",
    "import/no-unassigned-import",
    ...JSDOC_CONTENT_RULES,
    "unicorn/no-abusive-eslint-disable",
    "local/require-description",
  ]),
];

/**
 * The baseline rule names Oxlint applies to test files only: no focused
 * tests (including `.only` on `bun:test` imports), no duplicate titles and
 * no unawaited async matcher.
 */
const BASELINE_TEST_RULE_NAMES = [
  "jest/no-focused-tests",
  "jest/no-identical-title",
  "local/no-bun-test-only",
  "local/no-unawaited-async-matcher",
];

/**
 * Globs of test files the baseline test rules apply to.
 */
export const BASELINE_TEST_FILE_GLOBS = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/test/**/*.ts",
];

/**
 * Baseline rules whose setting carries options. Every other baseline rule is
 * a plain `"error"`.
 */
const BASELINE_RULE_OPTIONS = {
  "typescript/return-await": ["error", "in-try-catch"],
  "import/no-unassigned-import": [
    "error",
    { allow: ["**/*.css", "@fontsource/**", "@fontsource-variable/**"] },
  ],
};

/**
 * Builds a baseline rule map: every rule is an error, with its options when
 * `BASELINE_RULE_OPTIONS` lists them.
 * @param ruleNames Oxlint rule ids.
 * @returns The rule map Oxlint reads.
 */
function toBaselineRules(ruleNames) {
  return Object.fromEntries(
    ruleNames.map((ruleName) => [ruleName, BASELINE_RULE_OPTIONS[ruleName] ?? "error"]),
  );
}

/**
 * The baseline rule map for every file.
 */
export const OXLINT_BASELINE_RULES = toBaselineRules(BASELINE_RULE_NAMES);

/**
 * The baseline rule map for test files.
 */
export const OXLINT_BASELINE_TEST_RULES = toBaselineRules(BASELINE_TEST_RULE_NAMES);
