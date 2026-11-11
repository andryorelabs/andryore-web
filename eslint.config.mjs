import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import localPlugin from "./eslint-rules/index.mjs";

const ASTRO_FILES = ["**/*.astro"];

/**
 * The `<script>` blocks ESLint lints as virtual children of an `.astro` file.
 */
const ASTRO_SCRIPT_FILES = ["**/*.astro/*.{ts,js}"];

/**
 * The TypeScript `<script>` blocks, the only ones the jsdoc rules reach.
 */
const ASTRO_TS_SCRIPT_FILES = ["**/*.astro/*.ts"];

/**
 * The plain JavaScript `<script>` blocks, which only get the shared rules.
 */
const ASTRO_JS_SCRIPT_FILES = ["**/*.astro/*.js"];

const ASTRO_AND_SCRIPT_FILES = [...ASTRO_FILES, ...ASTRO_SCRIPT_FILES];

/**
 * The recommended `eslint-comments` rules, with `require-description` turned
 * on so every `eslint-disable*` comment must say why.
 */
const eslintCommentsRules = {
  ...eslintComments.configs.recommended.rules,
  "@eslint-community/eslint-comments/require-description": "error",
};

/**
 * `eslint-plugin-jsdoc`'s TypeScript-flavored recommended rules, with
 * `require-jsdoc` off and `informative-docs` on.
 */
const jsdocRules = {
  ...jsdoc.configs["flat/recommended-typescript-error"].rules,
  "jsdoc/require-jsdoc": "off",
  "jsdoc/informative-docs": "error",
};

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
 * ESLint lints `.astro` files and nothing else. Every other file is linted by
 * Oxlint (`oxlint.config.ts`), which cannot see the template of an Astro
 * component because JS plugins do not run on it yet.
 *
 * Exit condition: once oxc#23207 lets Oxlint JS plugins see the Astro
 * template, move these rules into `oxlint.config.ts`, delete this file and
 * the `eslint` and `eslint-plugin-astro` dependencies, and make
 * `bun run lint` Oxlint only.
 *
 * ESLint also lints every `<script>` block of an `.astro` file as a virtual
 * child file (`Foo.astro/1_1.ts`), so those are scoped here too: the
 * non-type-checked typescript-eslint `strict` and `stylistic` rules, `jsdoc`
 * on the TypeScript blocks, and the same rules as the component itself. Type
 * information is never available to them, so every type-checked rule is off.
 *
 * The `.astro` rule set is exactly: `astro/recommended`, `jsx-a11y`
 * recommended, `unicorn` recommended with this repo's overrides,
 * `local/no-non-doc-comments` and the `eslint-comments` rules. No rule here
 * needs type information, so the parser gets no `project`.
 */
export default defineConfig([
  {
    files: ASTRO_TS_SCRIPT_FILES,
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      tseslint.configs.disableTypeChecked,
    ],
    languageOptions: { parserOptions: { projectService: false } },
    rules: { "@typescript-eslint/consistent-type-imports": "error" },
  },
  {
    files: ASTRO_JS_SCRIPT_FILES,
    extends: [tseslint.configs.disableTypeChecked],
  },
  { files: ASTRO_AND_SCRIPT_FILES, extends: [jsxA11y.flatConfigs.recommended] },
  { files: ASTRO_AND_SCRIPT_FILES, extends: [unicorn.configs.recommended] },
  {
    files: ASTRO_AND_SCRIPT_FILES,
    rules: {
      "unicorn/number-literal-case": ["error", { hexadecimalValue: "lowercase" }],
      "unicorn/name-replacements": ["error", { allowList: NAME_REPLACEMENT_ALLOW_LIST }],
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
      "unicorn/filename-case": ["error", { cases: { kebabCase: true, pascalCase: true } }],
    },
  },
  ...astro.configs.recommended,
  {
    files: [...ASTRO_FILES, ...ASTRO_TS_SCRIPT_FILES],
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
    files: ASTRO_TS_SCRIPT_FILES,
    plugins: {
      jsdoc: jsdoc.configs["flat/recommended-typescript-error"].plugins.jsdoc,
    },
    rules: jsdocRules,
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
  globalIgnores(["**/.astro/**", "**/dist/**", "**/coverage/**", ".claude/**", ".agents/**"]),
]);
