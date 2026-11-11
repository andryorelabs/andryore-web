import { describe, expect, test } from "bun:test";

import { cn } from "./utilities";

describe("cn", () => {
  test("joins truthy classes and drops falsy ones", () => {
    expect(cn("a", false, undefined, "b", ["c"])).toBe("a b c");
  });

  test("lets the later Tailwind utility win a conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
