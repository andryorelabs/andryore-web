import { expect, test } from "bun:test";
import tseslint from "typescript-eslint";

import typescriptEslintPlugin from "./typescript-eslint.mjs";

test("default-exports the typescript-eslint plugin Oxlint loads as typescript-js", () => {
  expect(typescriptEslintPlugin).toBe(tseslint.plugin);
  expect(Object.keys(typescriptEslintPlugin.rules ?? {})).toContain("no-unused-vars");
});
