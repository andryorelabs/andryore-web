import { describe, expect, test } from "bun:test";

import {
  levelFromRatio,
  rubberBand,
  squeezeForLevel,
  stopAfterKey,
  stopFromLevel,
  stopFromRatio,
  stopLevel,
  stopStrength,
  THEME_STOPS,
} from "./theme-stops";

describe("theme stop levels", () => {
  test("map each stop to the brightness percentage of the canvas", () => {
    expect(stopLevel("dark")).toBe(24);
    expect(stopLevel("auto")).toBe(62);
    expect(stopLevel("light")).toBe(100);
  });

  test("the strength is a 0 to 1 fraction that drives the sun", () => {
    expect(stopStrength("light")).toBe(1);
    expect(stopStrength("auto")).toBe(0.62);
    expect(stopStrength("dark")).toBe(0.24);
  });
});

describe("theme stops", () => {
  test("are ordered Light, Auto, Dark", () => {
    expect(THEME_STOPS).toEqual(["light", "auto", "dark"]);
  });

  test("arrow keys step and clamp at the ends", () => {
    expect(stopAfterKey(0, "ArrowDown")).toBe(1);
    expect(stopAfterKey(1, "ArrowLeft")).toBe(2);
    expect(stopAfterKey(2, "ArrowDown")).toBe(2);
    expect(stopAfterKey(1, "ArrowUp")).toBe(0);
    expect(stopAfterKey(1, "ArrowRight")).toBe(0);
    expect(stopAfterKey(0, "ArrowRight")).toBe(0);
  });

  test("Home and End jump, other keys do nothing", () => {
    expect(stopAfterKey(1, "Home")).toBe(0);
    expect(stopAfterKey(1, "End")).toBe(2);
    expect(stopAfterKey(1, "a")).toBeUndefined();
  });

  test("a press maps to the third it lands in", () => {
    expect(stopFromRatio(-0.2)).toBe(0);
    expect(stopFromRatio(0.4)).toBe(1);
    expect(stopFromRatio(0.9)).toBe(2);
    expect(stopFromRatio(1.4)).toBe(2);
  });
});

describe("levelFromRatio", () => {
  test("is continuous between the ends, top full and bottom empty", () => {
    expect(levelFromRatio(0)).toBe(100);
    expect(levelFromRatio(1)).toBe(0);
    expect(levelFromRatio(0.5)).toBe(50);
    expect(levelFromRatio(0.3)).toBeCloseTo(70, 10);
  });

  test("rubber-bands past either end and stays within about 8 percent", () => {
    expect(levelFromRatio(-0.1)).toBeGreaterThan(100);
    expect(levelFromRatio(-0.1)).toBeLessThan(108);
    expect(levelFromRatio(1.1)).toBeLessThan(0);
    expect(levelFromRatio(1.1)).toBeGreaterThan(-8);
    expect(levelFromRatio(-50)).toBeLessThanOrEqual(108);
    expect(levelFromRatio(50)).toBeGreaterThanOrEqual(-8);
  });
});

describe("rubberBand", () => {
  test("starts damped by 0.35 and is odd around zero", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(1)).toBeCloseTo(0.35, 1);
    expect(rubberBand(-3)).toBe(-rubberBand(3));
  });

  test("is monotonic and bounded by the cap", () => {
    let previous = 0;
    for (let overshoot = 1; overshoot <= 100; overshoot += 1) {
      const banded = rubberBand(overshoot);
      expect(banded).toBeGreaterThan(previous);
      expect(banded).toBeLessThan(8);
      previous = banded;
    }
  });
});

describe("stopFromLevel", () => {
  test("snaps to the nearest of Light 100, Auto 62 and Dark 24", () => {
    expect(stopFromLevel(108)).toBe(0);
    expect(stopFromLevel(85)).toBe(0);
    expect(stopFromLevel(80)).toBe(1);
    expect(stopFromLevel(62)).toBe(1);
    expect(stopFromLevel(44)).toBe(1);
    expect(stopFromLevel(42)).toBe(2);
    expect(stopFromLevel(-8)).toBe(2);
  });
});

describe("squeezeForLevel", () => {
  test("is 1 inside the bar and reaches 0.96 at the full overshoot", () => {
    expect(squeezeForLevel(50)).toBe(1);
    expect(squeezeForLevel(100)).toBe(1);
    expect(squeezeForLevel(108)).toBeCloseTo(0.96, 10);
    expect(squeezeForLevel(-8)).toBeCloseTo(0.96, 10);
    expect(squeezeForLevel(104)).toBeCloseTo(0.98, 10);
  });
});
