import path from "node:path";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import eslintReact from "@eslint-react/eslint-plugin";
import { plugin as shadcn } from "@shadcn/lint";
import prettierConfig from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import localPlugin from "../eslint-rules/index.mjs";
import {
  shadcnNoRestyleContracts,
  UNAWAITED_ASYNC_MATCHER_SELECTORS,
} from "../eslint-rules/policy.mjs";

/**
 * `eslint-plugin-jsdoc`'s TypeScript-flavored recommended rules, with
 * `require-jsdoc` turned off (only non-obvious exports are documented) and
 * `informative-docs` turned on (rejects JSDoc that just restates the
 * declaration's name).
 */
const jsdocRules = {
  ...jsdoc.configs["flat/recommended-typescript-error"].rules,
  "jsdoc/require-jsdoc": "off",
  "jsdoc/informative-docs": "error",
};

/**
 * The recommended `eslint-comments` rules, with `require-description` turned
 * on so every `eslint-disable*` comment must say why.
 */
const eslintCommentsRules = {
  ...eslintComments.configs.recommended.rules,
  "@eslint-community/eslint-comments/require-description": "error",
};

/**
 * Files that hold React islands and the shadcn/ui components they use.
 */
const ISLAND_FILES = ["src/**/*.tsx"];

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
 * The full ESLint config as it stood before ESLint was scoped to `.astro`
 * files. `parity/run.ts` runs it as the baseline Oxlint is compared against;
 * it is never used to lint the repo. Keep it frozen.
 */
export default defineConfig([
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.resolve(import.meta.dirname, ".."),
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
  jsxA11y.flatConfigs.recommended,
  unicorn.configs.recommended,
  {
    rules: {
      "unicorn/name-replacements": ["error", { allowList: NAME_REPLACEMENT_ALLOW_LIST }],
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
      "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx,mjs}", "e2e/**"],
    rules: { "unicorn/no-null": "off" },
  },
  {
    files: ["**/*.config.{ts,mjs}"],
    rules: { "unicorn/no-top-level-side-effects": "off" },
  },
  ...astro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: path.resolve(import.meta.dirname, ".."),
      },
    },
    plugins: {
      local: localPlugin,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      ...eslintCommentsRules,
      "local/no-non-doc-comments": "error",
    },
  },
  {
    files: ["**/*.astro/*.{ts,js}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false } },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...UNAWAITED_ASYNC_MATCHER_SELECTORS],
    },
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: {
      jsdoc: jsdoc.configs["flat/recommended-typescript-error"].plugins.jsdoc,
      local: localPlugin,
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      ...jsdocRules,
      ...eslintCommentsRules,
      "local/no-non-doc-comments": "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["src/pages/**/*.astro"],
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          cases: { kebabCase: true, pascalCase: true },
          ignore: [
            String.raw`^\[\.{3}[a-z][a-zA-Z0-9]*\]\.astro$`,
            String.raw`^\[[a-z][a-zA-Z0-9]*\]\.astro$`,
            String.raw`^\([a-z][a-z0-9-]*\)$`,
          ],
        },
      ],
    },
  },
  {
    files: [".github/ISSUE_TEMPLATE/**"],
    rules: { "unicorn/filename-case": "off" },
  },
  {
    files: ISLAND_FILES,
    extends: [eslintReact.configs["recommended-typescript"]],
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.flat.recommended.rules },
  },
  {
    files: ISLAND_FILES,
    plugins: { shadcn },
    rules: {
      "shadcn/no-restyle": ["error", { allow: ["layout"], contracts: shadcnNoRestyleContracts }],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
    },
  },
  {
    files: ["src/components/ui/**"],
    rules: { "shadcn/no-restyle": "off" },
  },
  {
    files: ["parity/.corpus/**"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false } },
  },
  prettierConfig,
  globalIgnores([
    "**/.astro/**",
    "**/dist/**",
    "**/coverage/**",
    ".claude/**",
    ".agents/**",
    ".forge/**",
    "parity/fixtures/**",
    ...(process.env.PARITY_CORPUS === "1" ? [] : ["parity/.corpus/**"]),
  ]),
]);
