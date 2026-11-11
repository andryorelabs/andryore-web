import { describe, expect, test } from "bun:test";

import type { GridSnapshot } from "./github-grid";
import {
  computeStats,
  dayUnit,
  formatContributionTip,
  formatRelative,
  formatShortDate,
  gridCellsHtml,
  isLiveSnapshot,
  loadLiveSnapshot,
  monthLabels,
  statsView,
  updatedLabel,
} from "./github-stats";

const grid = (days: [string, number][]): GridSnapshot => ({
  capturedAt: "2026-01-10",
  total: days.reduce((sum, [, count]) => sum + count, 0),
  weeks: [days.map(([date, count]) => ({ date, count, level: 1 as const }))],
});

describe("computeStats", () => {
  test("is all zero for an empty grid", () => {
    expect(computeStats(grid([]))).toEqual({
      longestStreak: 0,
      currentStreak: 0,
      bestDay: undefined,
      activeDays: 0,
    });
  });

  test("handles a single active day", () => {
    expect(computeStats(grid([["2026-01-05", 4]]))).toEqual({
      longestStreak: 1,
      currentStreak: 1,
      bestDay: { date: "2026-01-05", count: 4 },
      activeDays: 1,
    });
  });

  test("keeps the earliest day on a tie for best day", () => {
    const stats = computeStats(
      grid([
        ["2026-01-01", 3],
        ["2026-01-02", 3],
        ["2026-01-03", 1],
      ]),
    );
    expect(stats.bestDay).toEqual({ date: "2026-01-01", count: 3 });
    expect(stats.longestStreak).toBe(3);
  });

  test("counts a streak across the year boundary", () => {
    const stats = computeStats(
      grid([
        ["2025-12-30", 1],
        ["2025-12-31", 2],
        ["2026-01-01", 1],
        ["2026-01-02", 0],
        ["2026-01-03", 1],
      ]),
    );
    expect(stats.longestStreak).toBe(3);
    expect(stats.currentStreak).toBe(1);
    expect(stats.activeDays).toBe(4);
  });

  test("keeps the current streak alive when the last day is still empty", () => {
    const stats = computeStats(
      grid([
        ["2026-01-01", 1],
        ["2026-01-02", 1],
        ["2026-01-03", 0],
      ]),
    );
    expect(stats.currentStreak).toBe(2);
  });

  test("breaks the current streak after two empty days", () => {
    const stats = computeStats(
      grid([
        ["2026-01-01", 1],
        ["2026-01-02", 0],
        ["2026-01-03", 0],
      ]),
    );
    expect(stats.currentStreak).toBe(0);
  });

  test("breaks a streak on a missing date", () => {
    const stats = computeStats(
      grid([
        ["2026-01-01", 1],
        ["2026-01-03", 1],
      ]),
    );
    expect(stats.longestStreak).toBe(1);
  });
});

describe("formatting", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  test("picks the day unit with plural rules", () => {
    const units = { one: "day", other: "days" };
    expect(dayUnit(1, "en", units)).toBe("day");
    expect(dayUnit(12, "en", units)).toBe("days");
  });

  test("formats a short UTC date", () => {
    expect(formatShortDate("2026-10-17", "en")).toBe("Oct 17");
    expect(formatShortDate("2026-10-17", "es")).toContain("17");
  });

  test("describes minutes, hours and days in English", () => {
    expect(formatRelative("2026-10-18T11:30:00Z", now, "en")).toBe("30 minutes ago");
    expect(formatRelative("2026-10-18T09:00:00Z", now, "en")).toBe("3 hours ago");
    expect(formatRelative("2026-10-15T09:00:00Z", now, "en")).toBe("3 days ago");
  });

  test("describes a bare date in whole days", () => {
    expect(formatRelative("2026-10-17", now, "en")).toBe("yesterday");
    expect(formatRelative("2026-10-18", now, "en")).toBe("today");
  });

  test("describes the same moments in Spanish", () => {
    expect(formatRelative("2026-10-18T09:00:00Z", now, "es")).toBe("hace 3 horas");
    expect(formatRelative("2026-10-15", now, "es")).toBe("hace 3 días");
  });

  test("puts a space between the prefix and the value", () => {
    expect(updatedLabel("Updated", "2026-10-15", now, "en")).toBe("Updated 3 days ago");
    expect(updatedLabel("Actualizado", "2026-10-15", now, "es")).toBe("Actualizado hace 3 días");
  });
});

describe("loadLiveSnapshot", () => {
  const live = {
    capturedAt: "2026-10-18",
    updatedAt: "2026-10-18T10:00:00.000Z",
    total: 1,
    weeks: [[{ date: "2026-10-18", count: 1, level: 1 }]],
  };

  test("returns the payload", async () => {
    expect(await loadLiveSnapshot(() => Promise.resolve(Response.json(live)))).toEqual(
      live as never,
    );
  });

  test("returns undefined on a 503, a bad body or a network error", async () => {
    expect(
      await loadLiveSnapshot(() => Promise.resolve(new Response("x", { status: 503 }))),
    ).toBeUndefined();
    expect(await loadLiveSnapshot(() => Promise.resolve(Response.json({ a: 1 })))).toBeUndefined();
    expect(await loadLiveSnapshot(() => Promise.reject(new Error("down")))).toBeUndefined();
  });
});

describe("gridCellsHtml and statsView", () => {
  test("renders one cell per day with level and tooltip", () => {
    expect(
      gridCellsHtml(
        [
          [
            { date: "2026-01-01", count: 0, level: 0 },
            { date: "2026-01-02", count: 4, level: 3 },
          ],
        ],
        (day) => `${day.date}|${String(day.count)}`,
      ),
    ).toBe(
      '<i data-level="0" data-tip="2026-01-01|0"></i><i data-level="3" data-tip="2026-01-02|4"></i>',
    );
  });

  test("escapes the tooltip text", () => {
    expect(gridCellsHtml([[{ date: "2026-01-01", count: 1, level: 1 }]], () => '"<&>')).toContain(
      'data-tip="&quot;&lt;&amp;&gt;"',
    );
  });

  test("formats the stats for display", () => {
    const view = statsView(
      computeStats(
        grid([
          ["2026-01-01", 1],
          ["2026-01-02", 7],
        ]),
      ),
      "es",
      { one: "día", other: "días" },
    );
    expect(view.longest).toBe("2");
    expect(view.longestUnit).toBe("días");
    expect(view.current).toBe("2");
    expect(view.currentUnit).toBe("días");
    expect(view.best).toBe("7");
    expect(view.active).toBe("2");
  });

  test("rejects payloads with unsafe dates", () => {
    expect(
      isLiveSnapshot({
        capturedAt: "x",
        updatedAt: "y",
        total: 1,
        weeks: [[{ date: '"><script>', count: 1, level: 1 }]],
      }),
    ).toBe(false);
  });
});

describe("formatContributionTip", () => {
  const en = {
    one: "{count} contribution on {date}",
    other: "{count} contributions on {date}",
    none: "No contributions on {date}",
  };
  const es = {
    one: "{count} contribución el {date}",
    other: "{count} contribuciones el {date}",
    none: "Sin contribuciones el {date}",
  };

  test("names the count and the full date in English", () => {
    expect(formatContributionTip({ date: "2026-10-12", count: 3 }, "en", en)).toBe(
      "3 contributions on Oct 12, 2026",
    );
    expect(formatContributionTip({ date: "2026-10-12", count: 1 }, "en", en)).toBe(
      "1 contribution on Oct 12, 2026",
    );
  });

  test("says so when the day is empty", () => {
    expect(formatContributionTip({ date: "2026-10-12", count: 0 }, "en", en)).toBe(
      "No contributions on Oct 12, 2026",
    );
  });

  test("follows the Spanish plural and date format", () => {
    expect(formatContributionTip({ date: "2026-10-12", count: 3 }, "es", es)).toBe(
      "3 contribuciones el 12 oct 2026",
    );
  });
});

const week = (date: string) => [{ date, count: 0, level: 0 as const }];

describe("monthLabels", () => {
  test("labels the week where a month first appears", () => {
    const weeks = [
      week("2026-01-04"),
      week("2026-01-11"),
      week("2026-01-18"),
      week("2026-01-25"),
      week("2026-02-01"),
      week("2026-02-08"),
    ];
    expect(monthLabels(weeks, "en")).toEqual([
      { label: "Jan", column: 1 },
      { label: "Feb", column: 5 },
    ]);
  });

  test("drops a first label that a month change would overlap", () => {
    const weeks = [
      week("2026-01-25"),
      week("2026-02-01"),
      week("2026-02-08"),
      week("2026-02-15"),
      week("2026-02-22"),
      week("2026-03-01"),
    ];
    expect(monthLabels(weeks, "en").map((month) => month.label)).toEqual(["Feb", "Mar"]);
  });

  test("uses the locale month names", () => {
    expect(monthLabels([week("2026-10-04")], "es")[0]?.label).toBe("oct");
  });
});
