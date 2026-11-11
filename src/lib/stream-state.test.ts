import { describe, expect, test } from "bun:test";

import {
  formatCompactCountdown,
  formatCountdown,
  formatNextStream,
  formatSession,
  nextSession,
  selectStreamView,
  weekColumn,
  weekStrip,
} from "./stream-state";

describe("formatCompactCountdown", () => {
  const units = { prefix: "in", day: "d", hour: "h", minute: "min" };
  const start = new Date("2026-10-20T19:00:00Z");

  test("shows days and hours when a day or more is left", () => {
    const now = new Date("2026-10-18T16:00:00Z");
    expect(formatCompactCountdown(start, now, units)).toBe("in 2 d 3 h");
  });

  test("shows hours and minutes under a day", () => {
    const now = new Date("2026-10-20T15:40:00Z");
    expect(formatCompactCountdown(start, now, units)).toBe("in 3 h 20 min");
  });

  test("shows only minutes under an hour and never goes negative", () => {
    expect(formatCompactCountdown(start, new Date("2026-10-20T18:45:00Z"), units)).toBe(
      "in 15 min",
    );
    expect(formatCompactCountdown(start, new Date("2026-10-21T00:00:00Z"), units)).toBe("in 0 min");
  });
});

describe("weekColumn", () => {
  test("maps UTC weekdays to a Monday-first column", () => {
    expect(weekColumn(new Date("2026-10-19T12:00:00Z"))).toBe(0);
    expect(weekColumn(new Date("2026-10-20T12:00:00Z"))).toBe(1);
    expect(weekColumn(new Date("2026-10-25T12:00:00Z"))).toBe(6);
  });
});

describe("weekStrip", () => {
  test("marks Tuesday and Thursday as sessions and today as current", () => {
    const strip = weekStrip(new Date("2026-10-22T08:00:00Z"));
    expect(strip.map((day) => day.session)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(strip.findIndex((day) => day.today)).toBe(3);
    expect(strip.filter((day) => day.today)).toHaveLength(1);
  });
});

describe("formatNextStream", () => {
  const start = new Date("2026-10-20T19:00:00Z");
  const now = new Date("2026-10-18T16:00:00Z");

  test("joins the short weekday, time and compact countdown", () => {
    const units = { prefix: "in", day: "d", hour: "h", minute: "min" };
    expect(formatNextStream(start, now, "en", units)).toBe("Tue 19:00 UTC · in 2 d 3 h");
  });

  test("capitalizes the weekday in Spanish", () => {
    const units = { prefix: "en", day: "d", hour: "h", minute: "min" };
    expect(formatNextStream(start, now, "es", units)).toBe("Mar 19:00 UTC · en 2 d 3 h");
  });
});

describe("selectStreamView", () => {
  test("live wins regardless of the flag", () => {
    const live = { state: "live", title: "x" } as const;
    expect(selectStreamView(live, false)).toBe("live");
    expect(selectStreamView(live, true)).toBe("live");
  });

  test("before streams start, offline and unavailable are coming soon", () => {
    expect(selectStreamView({ state: "offline" }, false)).toBe("coming-soon");
    expect(selectStreamView({ state: "unavailable" }, false)).toBe("coming-soon");
  });

  test("after streams start, offline is scheduled", () => {
    expect(selectStreamView({ state: "offline" }, true)).toBe("scheduled");
    expect(selectStreamView({ state: "unavailable" }, true)).toBe("unavailable");
  });
});

describe("nextSession", () => {
  test("before 19:00 on a Tuesday it is that same day", () => {
    const next = nextSession(new Date("2026-10-20T10:00:00Z"));
    expect(next.toISOString()).toBe("2026-10-20T19:00:00.000Z");
  });

  test("after Tuesday 19:00 it is Thursday", () => {
    const next = nextSession(new Date("2026-10-20T19:00:00Z"));
    expect(next.toISOString()).toBe("2026-10-22T19:00:00.000Z");
  });

  test("after Thursday it is next Tuesday, across a month end", () => {
    const next = nextSession(new Date("2026-10-29T20:00:00Z"));
    expect(next.toISOString()).toBe("2026-11-03T19:00:00.000Z");
  });
});

describe("formatting", () => {
  const start = new Date("2026-10-20T19:00:00Z");

  test("formats the session in each language", () => {
    expect(formatSession(start, "en")).toBe("Tue 19:00 UTC");
    expect(formatSession(start, "es")).toMatch(/^mar.? 19:00 UTC$/);
  });

  test("counts down in days, hours and minutes", () => {
    expect(formatCountdown(start, new Date("2026-10-18T19:00:00Z"), "en")).toBe("in 2 days");
    expect(formatCountdown(start, new Date("2026-10-18T20:00:00Z"), "en")).toBe("in 2 days");
    expect(formatCountdown(start, new Date("2026-10-19T18:00:00Z"), "en")).toBe("tomorrow");
    expect(formatCountdown(start, new Date("2026-10-20T16:30:00Z"), "en")).toBe("in 2 hours");
    expect(formatCountdown(start, new Date("2026-10-20T18:30:00Z"), "en")).toBe("in 30 minutes");
  });
});
