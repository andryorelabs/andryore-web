import { describe, expect, test } from "bun:test";

import {
  followPointer,
  pickAtPointer,
  isReducedMotionPreferred,
  releaseDrag,
  type DragBar,
} from "./theme-drag";

const TALL_BOX = { top: 100, height: 200 };
const EMPTY_BOX = { top: 0, height: 0 };

const WIDE_BOX = { top: 0, height: 56, left: 100, width: 200 };

const makeBar = (box: { top: number; height: number; left?: number; width?: number }) => {
  const properties = new Map<string, string>();
  const bar: DragBar = {
    getBoundingClientRect: () => box,
    style: {
      setProperty: (name, value) => {
        properties.set(name, String(value));
      },
      removeProperty: (name) => {
        const previous = properties.get(name) ?? "";
        properties.delete(name);
        return previous;
      },
    },
  };
  return { bar, properties };
};

describe("followPointer", () => {
  test("writes the level and the squeeze under the pointer", () => {
    const { bar, properties } = makeBar(TALL_BOX);
    const level = { current: 0 };
    followPointer(bar, 160, level, false);
    expect(level.current).toBeCloseTo(70, 5);
    expect(properties.get("--drag-level")).toBe(String(level.current));
    expect(properties.get("--drag-squeeze")).toBe("1");
  });

  test("rubber-bands above the top by at most 8 points and squeezes", () => {
    const { bar, properties } = makeBar(TALL_BOX);
    const level = { current: 0 };
    followPointer(bar, -500, level, false);
    expect(level.current).toBeGreaterThan(100);
    expect(level.current).toBeLessThanOrEqual(108);
    expect(Number(properties.get("--drag-squeeze"))).toBeLessThan(1);
  });

  test("clamps to 0 and 100 under reduced motion", () => {
    const { bar } = makeBar(TALL_BOX);
    const level = { current: 50 };
    followPointer(bar, -500, level, true);
    expect(level.current).toBe(100);
    followPointer(bar, 5000, level, true);
    expect(level.current).toBe(0);
  });

  test("leaves everything alone without a bar or a box", () => {
    const level = { current: 42 };
    followPointer(null, 10, level, false);
    const { bar, properties } = makeBar(EMPTY_BOX);
    followPointer(bar, 10, level, false);
    expect(level.current).toBe(42);
    expect(properties.size).toBe(0);
  });
});

describe("releaseDrag", () => {
  test("removes the live properties and names the nearest stop", () => {
    const { bar, properties } = makeBar(TALL_BOX);
    const level = { current: 0 };
    followPointer(bar, 160, level, false);
    expect(releaseDrag(bar, level.current)).toBe("auto");
    expect(properties.size).toBe(0);
  });

  test("names the nearest stop at both ends", () => {
    expect(releaseDrag(null, 100)).toBe("light");
    expect(releaseDrag(null, 0)).toBe("dark");
  });
});

describe("pickAtPointer", () => {
  test("picks the stop in the third of the bar under the pointer", () => {
    const { bar } = makeBar(TALL_BOX);
    expect(pickAtPointer(bar, 110)).toBe("light");
    expect(pickAtPointer(bar, 200)).toBe("auto");
    expect(pickAtPointer(bar, 290)).toBe("dark");
  });

  test("picks nothing without a bar or a box", () => {
    expect(pickAtPointer(null, 10)).toBeUndefined();
    expect(pickAtPointer(makeBar(EMPTY_BOX).bar, 10)).toBeUndefined();
  });
});

describe("isReducedMotionPreferred", () => {
  test("is false where the browser has no matchMedia", () => {
    expect(isReducedMotionPreferred()).toBe(false);
    expect(isReducedMotionPreferred(() => ({ matches: false }))).toBe(false);
  });

  test("reads the reduce query", () => {
    const queries: string[] = [];
    const match = (query: string) => {
      queries.push(query);
      return { matches: true };
    };
    expect(isReducedMotionPreferred(match)).toBe(true);
    expect(queries).toEqual(["(prefers-reduced-motion: reduce)"]);
  });
});

describe("horizontal bar", () => {
  test("follows the pointer along X, light on the right", () => {
    const { bar, properties } = makeBar(WIDE_BOX);
    const level = { current: 0 };
    followPointer(bar, 240, level, false, "horizontal");
    expect(level.current).toBeCloseTo(70, 5);
    expect(properties.get("--drag-squeeze")).toBe("1");
  });

  test("picks the stop under the pointer along X", () => {
    const { bar } = makeBar(WIDE_BOX);
    expect(pickAtPointer(bar, 290, "horizontal")).toBe("light");
    expect(pickAtPointer(bar, 110, "horizontal")).toBe("dark");
    expect(pickAtPointer(bar, 200, "horizontal")).toBe("auto");
  });

  test("rubber-bands past both ends by at most 8 points", () => {
    const { bar } = makeBar(WIDE_BOX);
    const level = { current: 0 };
    followPointer(bar, 9000, level, false, "horizontal");
    expect(level.current).toBeGreaterThan(100);
    expect(level.current).toBeLessThanOrEqual(108);
    followPointer(bar, -9000, level, false, "horizontal");
    expect(level.current).toBeLessThan(0);
    expect(level.current).toBeGreaterThanOrEqual(-8);
  });

  test("clamps under reduced motion and has no box without a width", () => {
    const { bar } = makeBar(WIDE_BOX);
    const level = { current: 0 };
    followPointer(bar, 9000, level, true, "horizontal");
    expect(level.current).toBe(100);
    expect(pickAtPointer(makeBar({ top: 0, height: 56 }).bar, 5, "horizontal")).toBeUndefined();
  });
});
