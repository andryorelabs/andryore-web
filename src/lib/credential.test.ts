import { describe, expect, test } from "bun:test";

import { usableCredential } from "./credential";

describe("usableCredential", () => {
  test("returns a plain value trimmed", () => {
    expect(usableCredential("  ghp_value\n")).toBe("ghp_value");
  });

  test("treats missing and blank values as absent", () => {
    expect(usableCredential(undefined)).toBeUndefined();
    expect(usableCredential("")).toBeUndefined();
    expect(usableCredential(" ".repeat(3))).toBeUndefined();
  });

  test("treats dotenvx ciphertext as absent", () => {
    expect(usableCredential("encrypted:BOwI3k")).toBeUndefined();
  });
});
