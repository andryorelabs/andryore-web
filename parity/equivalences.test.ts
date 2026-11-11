import { describe, expect, test } from "bun:test";

import { resolveGate, type Finding } from "./diff";
import { EQUIVALENCES, resolveEquivalences } from "./equivalences";

const finding = (file: string, line: number, rule: string): Finding => ({
  file,
  line,
  rule,
});

const USELESS = "unicorn/no-useless-template-literals";

describe("EQUIVALENCES", () => {
  test("lists the type-aware rules covering the useless template rule", () => {
    expect(EQUIVALENCES.get(USELESS)).toEqual([
      "@typescript-eslint/no-base-to-string",
      "@typescript-eslint/restrict-template-expressions",
    ]);
  });
});

describe("resolveEquivalences", () => {
  test.each([
    "@typescript-eslint/no-base-to-string",
    "@typescript-eslint/restrict-template-expressions",
  ])("covers a finding when Oxlint reports %s on the same line", (rule) => {
    const result = resolveEquivalences([finding("a.ts", 8, USELESS)], [finding("a.ts", 8, rule)]);
    expect(result.covered).toEqual([{ ...finding("a.ts", 8, USELESS), coveredBy: rule }]);
    expect(result.remaining).toEqual([]);
  });

  test("the gate fails when the covering finding is absent", () => {
    const { remaining } = resolveEquivalences([finding("a.ts", 8, USELESS)], []);
    expect(resolveGate(remaining, []).exitCode).toBe(1);
  });

  test("the gate fails when the covering rule reports another line or file", () => {
    const { remaining } = resolveEquivalences(
      [finding("a.ts", 8, USELESS)],
      [
        finding("a.ts", 9, "@typescript-eslint/no-base-to-string"),
        finding("b.ts", 8, "@typescript-eslint/no-base-to-string"),
      ],
    );
    expect(remaining).toEqual([finding("a.ts", 8, USELESS)]);
    expect(resolveGate(remaining, []).exitCode).toBe(1);
  });

  test("an unrelated Oxlint rule on the same line does not cover it", () => {
    const { remaining } = resolveEquivalences(
      [finding("a.ts", 8, USELESS)],
      [finding("a.ts", 8, "no-console")],
    );
    expect(remaining).toHaveLength(1);
  });

  test("a rule without an equivalence is never covered", () => {
    const { covered, remaining } = resolveEquivalences(
      [finding("a.ts", 8, "no-console")],
      [finding("a.ts", 8, "no-console")],
    );
    expect(covered).toEqual([]);
    expect(remaining).toHaveLength(1);
  });
});
