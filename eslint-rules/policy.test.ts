import { describe, expect, it } from "bun:test";
import { Linter } from "eslint";

import { shadcnNoRestyleContracts, UNAWAITED_ASYNC_MATCHER_SELECTORS } from "./policy.mjs";

const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      rules: {
        "no-restricted-syntax": ["error", ...UNAWAITED_ASYNC_MATCHER_SELECTORS],
      },
    },
  ]);
}

describe("unawaited async matcher selectors", () => {
  it("flags an un-awaited rejects matcher", () => {
    expect(lint("expect(p).rejects.toThrow()")).toHaveLength(1);
  });

  it("flags an un-awaited negated resolves matcher", () => {
    expect(lint("expect(p).resolves.not.toBe(1)")).toHaveLength(1);
  });

  it("accepts an awaited matcher", () => {
    expect(lint("await expect(p).rejects.toThrow()")).toHaveLength(0);
  });

  it("accepts a returned matcher", () => {
    expect(lint("const f = () => expect(p).resolves.toBe(1)")).toHaveLength(0);
  });
});

describe("shadcn no-restyle contracts", () => {
  it("starts empty", () => {
    expect(shadcnNoRestyleContracts).toEqual([]);
  });
});
