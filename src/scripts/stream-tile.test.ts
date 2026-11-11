import { describe, expect, test } from "bun:test";

import type { StreamStatus } from "../lib/twitch-status";
import {
  loadStreamStatus,
  mountStreamTile,
  refreshCountdown,
  STATUS_ENDPOINT,
  type StreamTileElement,
  type StreamTileRoot,
} from "./stream-tile";

const respond =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(Response.json(body, { status }));

const createRoot = (hasStarted: boolean) => {
  const title = { hidden: false, textContent: "" };
  const next = { hidden: false, textContent: "" };
  const days = new Map<string, StreamTileElement>(
    Array.from({ length: 7 }, (_, column) => [String(column), { hidden: false, dataset: {} }]),
  );
  const root: StreamTileRoot = {
    dataset: {
      state: "coming-soon",
      started: String(hasStarted),
      locale: "en",
      cdIn: "in",
      cdDay: "d",
      cdHour: "h",
      cdMinute: "min",
    },
    querySelector: (selector: string) => {
      if (selector === "[data-stream-title]") return title;
      if (selector === "[data-stream-next]") return next;
      const match = /\[data-stream-day="(\d)"\]/.exec(selector);
      return days.get(match?.[1] ?? "") ?? null;
    },
  };
  return { root, title, next, days };
};

describe("loadStreamStatus", () => {
  test("reads a live payload", async () => {
    const status = await loadStreamStatus(respond({ state: "live", title: "Hello" }));
    expect(status).toEqual({ state: "live", title: "Hello" });
  });

  test("reads an offline payload", async () => {
    expect(await loadStreamStatus(respond({ state: "offline" }))).toEqual({
      state: "offline",
    });
  });

  test("is unavailable on a failed request, bad status or bad payload", async () => {
    const unavailable: StreamStatus = { state: "unavailable" };
    expect(await loadStreamStatus(() => Promise.reject(new Error("down")))).toEqual(unavailable);
    expect(await loadStreamStatus(respond({}, 502))).toEqual(unavailable);
    expect(await loadStreamStatus(respond({ state: "weird" }))).toEqual(unavailable);
    expect(await loadStreamStatus(respond("text"))).toEqual(unavailable);
  });

  test("calls only the same-origin endpoint", async () => {
    const urls: string[] = [];
    await loadStreamStatus((url) => {
      urls.push(url);
      return Promise.resolve(new Response("{}"));
    });
    expect(urls).toEqual([STATUS_ENDPOINT]);
    expect(STATUS_ENDPOINT.startsWith("/")).toBe(true);
  });
});

describe("mountStreamTile", () => {
  const now = new Date("2026-10-18T16:00:00Z");

  test("sets the live state with the stream title", async () => {
    const { root, title } = createRoot(false);
    await mountStreamTile(root, respond({ state: "live", title: "On air" }), now);
    expect(root.dataset.state).toBe("live");
    expect(title.textContent).toBe("On air");
  });

  test("calls onLive once when live and never otherwise", async () => {
    const live = createRoot(false);
    let calls = 0;
    const onLive = (): void => {
      calls += 1;
    };
    await mountStreamTile(live.root, respond({ state: "live", title: "On air" }), now, onLive);
    expect(calls).toBe(1);
    await mountStreamTile(createRoot(false).root, respond({ state: "offline" }), now, onLive);
    expect(calls).toBe(1);
  });

  test("keeps the fallback caption when the live title is empty", async () => {
    const { root, title } = createRoot(false);
    title.textContent = "Fallback";
    await mountStreamTile(root, respond({ state: "live", title: "" }), now);
    expect(root.dataset.state).toBe("live");
    expect(title.textContent).toBe("Fallback");
  });

  test("keeps coming soon before streams start", async () => {
    const { root, next } = createRoot(false);
    await mountStreamTile(root, respond({ state: "offline" }), now);
    expect(root.dataset.state).toBe("coming-soon");
    expect(next.textContent).toBe("");
  });

  test("shows the next session and the live countdown once started", async () => {
    const { root, next } = createRoot(true);
    await mountStreamTile(root, respond({ state: "offline" }), now);
    expect(root.dataset.state).toBe("scheduled");
    expect(next.textContent).toBe("Tue 19:00 UTC · in 2 d 3 h");
  });

  test("outlines only today in the week row", async () => {
    const { root, days } = createRoot(true);
    await mountStreamTile(root, respond({ state: "offline" }), now);
    const marked = [...days].filter(([, day]) => day.dataset?.today === "true");
    expect(marked.map(([column]) => column)).toEqual(["6"]);
  });

  test("shows unavailable once started and the endpoint is down", async () => {
    const { root } = createRoot(true);
    await mountStreamTile(root, () => Promise.reject(new Error("down")), now);
    expect(root.dataset.state).toBe("unavailable");
  });
});

describe("refreshCountdown", () => {
  test("moves the countdown forward with the clock", () => {
    const { root, next } = createRoot(true);
    refreshCountdown(root, new Date("2026-10-20T15:40:00Z"));
    expect(next.textContent).toBe("Tue 19:00 UTC · in 3 h 20 min");
    refreshCountdown(root, new Date("2026-10-20T15:41:00Z"));
    expect(next.textContent).toBe("Tue 19:00 UTC · in 3 h 19 min");
  });
});
