import { describe, expect, test } from "bun:test";

import { isMotionReduced, REVEAL_STAGGER_MS, revealClass, revealDelay } from "./motion";

const matchesReducedMotion = (query: string) => ({
  matches: query === "(prefers-reduced-motion: reduce)",
});

describe("revealDelay", () => {
  test("staggers each item by the stagger step", () => {
    expect(REVEAL_STAGGER_MS).toBe(60);
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(3)).toBe(180);
  });

  test("treats negative and fractional indexes as whole steps from zero", () => {
    expect(revealDelay(-2)).toBe(0);
    expect(revealDelay(1.9)).toBe(60);
  });
});

describe("revealClass", () => {
  test("names the stagger step as a class", () => {
    expect(revealClass(4)).toBe("reveal-4");
    expect(revealClass(-1)).toBe("reveal-0");
  });

  test("caps at the last class", () => {
    expect(revealClass(40)).toBe("reveal-11");
  });
});

describe("isMotionReduced", () => {
  test("is true when the media query matches", () => {
    expect(isMotionReduced({ matchMedia: matchesReducedMotion })).toBe(true);
  });

  test("is false when it does not match", () => {
    expect(isMotionReduced({ matchMedia: () => ({ matches: false }) })).toBe(false);
  });

  test("is false without a window", () => {
    expect(isMotionReduced()).toBe(false);
  });
});
