import { describe, expect, test } from "bun:test";

import { createStackSoundMapper, sceneProgress, tickIndex, tickRate } from "./stack-sound";

describe("sceneProgress", () => {
  test("is 0 when the scene top meets the viewport bottom", () => {
    expect(sceneProgress({ top: 800, height: 2000 }, 800)).toBe(0);
    expect(sceneProgress({ top: 1200, height: 2000 }, 800)).toBe(0);
  });

  test("is 1 once the bottom is 40% of a viewport above the top", () => {
    expect(sceneProgress({ top: -2320, height: 2000 }, 800)).toBe(1);
    expect(sceneProgress({ top: -5000, height: 2000 }, 800)).toBe(1);
  });

  test("is linear in between and safe for an empty span", () => {
    expect(sceneProgress({ top: 800 - 1160, height: 2000 }, 800)).toBeCloseTo(0.5);
    expect(sceneProgress({ top: 0, height: 0 }, 0)).toBe(0);
  });
});

describe("tickIndex and tickRate", () => {
  test("spans 0 to the tile count over the converge range", () => {
    expect(tickIndex(0, 24)).toBe(0);
    expect(tickIndex(0.32, 24)).toBe(12);
    expect(tickIndex(0.64, 24)).toBe(24);
    expect(tickIndex(1, 24)).toBe(24);
    expect(tickIndex(0.32, 12)).toBe(6);
  });

  test("rises linearly from 0.9 to 1.4", () => {
    expect(tickRate(0, 24)).toBeCloseTo(0.9);
    expect(tickRate(12, 24)).toBeCloseTo(1.15);
    expect(tickRate(24, 24)).toBeCloseTo(1.4);
    expect(tickRate(5, 0)).toBe(0.9);
  });
});

describe("createStackSoundMapper", () => {
  test("stays silent on the first update", () => {
    const mapper = createStackSoundMapper();
    expect(mapper.update(0.5, 24, 0)).toEqual({});
    expect(mapper.update(0.9, 24, 100).settle).toBe(true);
  });

  test("does not settle when it starts past the settle point", () => {
    const mapper = createStackSoundMapper();
    mapper.update(0.9, 24, 0);
    expect(mapper.update(0.95, 24, 100).settle).toBeUndefined();
  });

  test("ticks on each index change in both directions", () => {
    const mapper = createStackSoundMapper();
    mapper.update(0, 24, 0);
    expect(mapper.update(0.03, 24, 100).tickRate).toBeCloseTo(tickRate(1, 24));
    expect(mapper.update(0.031, 24, 200).tickRate).toBeUndefined();
    expect(mapper.update(0, 24, 300).tickRate).toBeCloseTo(0.9);
  });

  test("drops ticks inside the throttle gap instead of queuing them", () => {
    const mapper = createStackSoundMapper();
    mapper.update(0, 24, 0);
    expect(mapper.update(0.03, 24, 100).tickRate).toBeDefined();
    expect(mapper.update(0.06, 24, 120).tickRate).toBeUndefined();
    expect(mapper.update(0.06, 24, 400).tickRate).toBeUndefined();
    expect(mapper.update(0.09, 24, 500).tickRate).toBeDefined();
  });

  test("settles once per forward pass and re-arms below 0.6", () => {
    const mapper = createStackSoundMapper();
    mapper.update(0.5, 24, 0);
    expect(mapper.update(0.73, 24, 100).settle).toBe(true);
    expect(mapper.update(0.8, 24, 200).settle).toBeUndefined();
    expect(mapper.update(0.65, 24, 300).settle).toBeUndefined();
    expect(mapper.update(0.73, 24, 400).settle).toBeUndefined();
    mapper.update(0.55, 24, 500);
    expect(mapper.update(0.73, 24, 600).settle).toBe(true);
  });

  test("resets its baseline when the tile count changes", () => {
    const mapper = createStackSoundMapper();
    mapper.update(0.3, 24, 0);
    expect(mapper.update(0.3, 12, 100)).toEqual({});
  });
});
