import { describe, expect, test } from "bun:test";

import { nextCellIndex } from "./github-grid-nav";

describe("nextCellIndex", () => {
  test("moves a day down and up inside a week", () => {
    expect(nextCellIndex(3, "ArrowDown", 100)).toBe(4);
    expect(nextCellIndex(3, "ArrowUp", 100)).toBe(2);
  });

  test("moves a week right and left", () => {
    expect(nextCellIndex(10, "ArrowRight", 100)).toBe(17);
    expect(nextCellIndex(10, "ArrowLeft", 100)).toBe(3);
  });

  test("clamps at both ends", () => {
    expect(nextCellIndex(0, "ArrowUp", 100)).toBe(0);
    expect(nextCellIndex(99, "ArrowRight", 100)).toBe(99);
  });

  test("jumps with Home and End", () => {
    expect(nextCellIndex(50, "Home", 100)).toBe(0);
    expect(nextCellIndex(50, "End", 100)).toBe(99);
  });

  test("returns null for other keys and empty grids", () => {
    expect(nextCellIndex(1, "a", 100)).toBeUndefined();
    expect(nextCellIndex(0, "Home", 0)).toBeUndefined();
  });
});
