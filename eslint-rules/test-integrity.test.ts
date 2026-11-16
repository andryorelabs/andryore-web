import { describe, it } from "bun:test";
import { RuleTester } from "eslint";

import { noBunTestOnly, noUnawaitedAsyncMatcher } from "./test-integrity.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

ruleTester.run("no-unawaited-async-matcher", noUnawaitedAsyncMatcher, {
  valid: [
    {
      name: "awaited rejects",
      code: "await expect(load()).rejects.toThrow();",
    },
    {
      name: "awaited resolves",
      code: "await expect(load()).resolves.toBe(1);",
    },
    {
      name: "returned assertion",
      code: "function check() { return expect(load()).rejects.toThrow(); }",
    },
    {
      name: "arrow body assertion",
      code: "const check = () => expect(load()).resolves.toBe(1);",
    },
    { name: "synchronous matcher", code: "expect(value).toBe(1);" },
    {
      name: "rejects on something other than expect",
      code: "promise.rejects.toThrow();",
    },
    {
      name: "rejects on a non-identifier callee",
      code: "make()(value).rejects.toThrow();",
    },
    {
      name: "computed non-string member",
      code: "expect(load())[key].toThrow();",
    },
    { name: "a bare call", code: "load();" },
  ],
  invalid: [
    {
      name: "bare rejects",
      code: "expect(load()).rejects.toThrow();",
      errors: [{ messageId: "unawaited" }],
    },
    {
      name: "negated resolves",
      code: "expect(load()).resolves.not.toBe(1);",
      errors: [{ messageId: "unawaited" }],
    },
    {
      name: "computed rejects",
      code: 'expect(load())["rejects"].toThrow();',
      errors: [{ messageId: "unawaited" }],
    },
    {
      name: "assertion assigned without await",
      code: "const pending = expect(load()).rejects.toThrow();",
      errors: [{ messageId: "unawaited" }],
    },
  ],
});

ruleTester.run("no-bun-test-only", noBunTestOnly, {
  valid: [
    {
      name: "plain test",
      code: 'import { test } from "bun:test";\ntest("a", () => {});',
    },
    {
      name: "only on a test from another module",
      code: 'import { test } from "vitest";\ntest.only("a", () => {});',
    },
    {
      name: "only on a non-focusable bun:test import",
      code: 'import { expect } from "bun:test";\nexpect.only();',
    },
    {
      name: "only on a namespace member that is not a test function",
      code: 'import * as bun from "bun:test";\nbun.expect.only();',
    },
    {
      name: "only on a non-namespace object",
      code: 'import { test } from "bun:test";\nother.test.only("a", () => {});',
    },
    {
      name: "default import is ignored",
      code: 'import bun from "bun:test";\nbun.only();',
    },
    {
      name: "only on a call result",
      code: 'import { test } from "bun:test";\nmake().only();',
    },
  ],
  invalid: [
    {
      name: "test.only",
      code: 'import { test } from "bun:test";\ntest.only("a", () => {});',
      errors: [{ messageId: "focused" }],
    },
    {
      name: "aliased describe.only",
      code: 'import { describe as group } from "bun:test";\ngroup.only("a", () => {});',
      errors: [{ messageId: "focused" }],
    },
    {
      name: "string-named import",
      code: 'import { "it" as spec } from "bun:test";\nspec.only("a", () => {});',
      errors: [{ messageId: "focused" }],
    },
    {
      name: "namespace import",
      code: 'import * as bun from "bun:test";\nbun.test.only("a", () => {});',
      errors: [{ messageId: "focused" }],
    },
    {
      name: "computed only",
      code: 'import { it } from "bun:test";\nit["only"]("a", () => {});',
      errors: [{ messageId: "focused" }],
    },
  ],
});
