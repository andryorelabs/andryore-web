import { describe, expect, test } from "bun:test";

import { CLOCK_INTERVAL_MS, renderClock, startClock, type ClockParts } from "./clock-tile";

const greetings = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good night",
};

const createParts = (): ClockParts => ({
  greeting: { textContent: "Hello" },
  local: { textContent: "--:--" },
  utc: { textContent: "--:--" },
  greetings,
});

describe("renderClock", () => {
  test("writes the greeting for the local hour and both times", () => {
    const parts = createParts();
    renderClock(parts, new Date("2026-10-17T15:05:00Z"), "Asia/Tokyo");
    expect(parts.local.textContent).toBe("00:05");
    expect(parts.utc.textContent).toBe("15:05");
    expect(parts.greeting?.textContent).toBe("Good night");
  });

  test("greets by the hour in the given zone, not UTC", () => {
    const parts = createParts();
    renderClock(parts, new Date("2026-10-17T15:05:00Z"), "America/Lima");
    expect(parts.local.textContent).toBe("10:05");
    expect(parts.greeting?.textContent).toBe("Good morning");
  });
});

describe("renderClock without a greeting", () => {
  test("writes only the two times", () => {
    const parts: ClockParts = {
      local: { textContent: "--:--" },
      utc: { textContent: "--:--" },
    };
    renderClock(parts, new Date("2026-10-17T15:05:00Z"), "America/Lima");
    expect(parts.local.textContent).toBe("10:05");
    expect(parts.utc.textContent).toBe("15:05");
  });
});

describe("startClock", () => {
  test("renders at once and then on a 30 s interval, never faster", () => {
    const parts = createParts();
    const cleared: number[] = [];
    const calls: { handler: () => void; delay: number }[] = [];
    let current = new Date("2026-10-17T15:05:00Z");
    const stop = startClock(parts, {
      now: () => current,
      timeZone: "UTC",
      setInterval: (handler, delay) => {
        calls.push({ handler, delay });
        return 7;
      },
      clearInterval: (id) => {
        cleared.push(id);
      },
    });
    expect(parts.local.textContent).toBe("15:05");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.delay).toBe(CLOCK_INTERVAL_MS);
    expect(CLOCK_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
    current = new Date("2026-10-17T15:06:00Z");
    calls[0]?.handler();
    expect(parts.local.textContent).toBe("15:06");
    expect(cleared).toEqual([]);
    stop();
    expect(cleared).toEqual([7]);
  });

  test("stop clears the interval", () => {
    const cleared: number[] = [];
    const stop = startClock(createParts(), {
      now: () => new Date(),
      setInterval: () => 42,
      clearInterval: (id) => {
        cleared.push(id);
      },
    });
    stop();
    expect(cleared).toEqual([42]);
  });
});
