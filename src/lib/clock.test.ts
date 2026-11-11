import { describe, expect, test } from "bun:test";

import { formatClock, greetingPeriod } from "./clock";

describe("greetingPeriod", () => {
  test("maps each local hour to a period", () => {
    const expected: Record<number, string> = {
      0: "night",
      4: "night",
      5: "morning",
      11: "morning",
      12: "afternoon",
      17: "afternoon",
      18: "evening",
      21: "evening",
      22: "night",
      23: "night",
    };
    for (const [hour, period] of Object.entries(expected)) {
      expect(greetingPeriod(Number(hour))).toBe(period as never);
    }
  });
});

describe("formatClock", () => {
  const instant = new Date("2026-10-17T15:05:00Z");

  test("formats UTC as 24h HH:MM", () => {
    expect(formatClock(instant, "UTC")).toBe("15:05");
  });

  test("formats another zone without a locale-dependent shape", () => {
    expect(formatClock(instant, "Asia/Tokyo")).toBe("00:05");
  });
});
