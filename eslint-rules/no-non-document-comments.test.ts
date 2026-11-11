import { describe, it } from "bun:test";
import { RuleTester } from "eslint";

import rule from "./no-non-document-comments.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-non-doc-comments", rule, {
  valid: [
    {
      name: "JSDoc block comment",
      code: "/**\n * Explains the export.\n */\nexport const value = 1\n",
    },
    {
      name: "eslint directive",
      code: '/* eslint quotes: ["error", "single"] */\nexport const value = 1\n',
    },
    {
      name: "eslint-disable directive",
      code: "// eslint-disable-next-line no-console\nconsole.log(1)\n",
    },
    {
      name: "eslint-enable directive",
      code: "/* eslint-disable no-console */\nconsole.log(1)\n/* eslint-enable no-console */\n",
    },
    {
      name: "oxlint-disable-next-line directive",
      code: "// oxlint-disable-next-line no-console -- reason\nconsole.log(1)\n",
    },
    {
      name: "oxlint-disable and oxlint-enable block directives",
      code: "/* oxlint-disable no-console */\nconsole.log(1)\n/* oxlint-enable no-console */\n",
    },
    {
      name: "bare oxlint-disable line directive",
      code: "// oxlint-disable\nconsole.log(1)\n",
    },
    {
      name: "global directive",
      code: "/* global window */\nwindow.focus()\n",
    },
    {
      name: "@ts- directive",
      code: "// @ts-expect-error the shim below is intentionally untyped\nconst value = window.doesNotExist\n",
    },
    {
      name: "prettier-ignore directive",
      code: "// prettier-ignore\nconst matrix = [1, 0, 0, 1]\n",
    },
    {
      name: "triple-slash reference directive",
      code: '/// <reference types="vite/client" />\nexport const value = 1\n',
    },
    {
      name: "JSX JSDoc comment",
      code: "const element = (\n  <div>\n    {/**\n     * Explains the child.\n     */}\n    <span />\n  </div>\n)\n",
    },
  ],
  invalid: [
    {
      name: "line comment",
      code: "// explains the export\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "trailing line comment",
      code: "export const value = 1 // explains the export\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "non-JSDoc block comment",
      code: "/* explains the export */\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "JSX block comment",
      code: "const element = (\n  <div>\n    {/* explains the child */}\n    <span />\n  </div>\n)\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "prose starting with the word global",
      code: "// globally cached, reset per request\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "prose starting with the word eslint",
      code: "// eslint is slow here\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "prose starting with the word oxlint",
      code: "// oxlint is fast here\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
    {
      name: "prose starting with an oxlint- compound word",
      code: "// oxlint-style tooling runs here\nexport const value = 1\n",
      errors: [{ messageId: "noNonDocComment" }],
    },
  ],
});
