import { describe, expect, test } from "bun:test";

import { CACHE_TTL_MS, createLiveStatus, statusResponse, type FetchLike } from "./twitch-status";

interface Call {
  url: string;
  init?: RequestInit;
}

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

const stubTwitch = (streams: unknown[], calls: Call[] = []): FetchLike => {
  return (url, init) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(
      json(
        String(url).includes("id.twitch.tv")
          ? { access_token: "token-123", expires_in: 3600 }
          : { data: streams },
      ),
    );
  };
};

const credentials = { clientId: "id-abc", clientSecret: "secret-xyz" };

describe("createLiveStatus", () => {
  test("reports live with the stream title", async () => {
    const status = createLiveStatus({
      ...credentials,
      fetch: stubTwitch([{ type: "live", title: "Building the site" }]),
    });
    expect(await status.get()).toEqual({
      state: "live",
      title: "Building the site",
    });
  });

  test("reports offline when the channel has no stream", async () => {
    const status = createLiveStatus({
      ...credentials,
      fetch: stubTwitch([]),
    });
    expect(await status.get()).toEqual({ state: "offline" });
  });

  test("falls back to offline on a network error", async () => {
    const status = createLiveStatus({
      ...credentials,
      fetch: () => Promise.reject(new Error("network down")),
    });
    expect(await status.get()).toEqual({ state: "offline" });
  });

  test("falls back to offline on a non-ok response or malformed body", async () => {
    const failing = createLiveStatus({
      ...credentials,
      fetch: () => Promise.resolve(json({}, 500)),
    });
    expect(await failing.get()).toEqual({ state: "offline" });

    const malformed = createLiveStatus({
      ...credentials,
      fetch: () => Promise.resolve(json({ nope: true })),
    });
    expect(await malformed.get()).toEqual({ state: "offline" });
  });

  test("is unavailable when credentials are missing, without calling Twitch", async () => {
    const calls: Call[] = [];
    const status = createLiveStatus({
      clientId: undefined,
      clientSecret: "",
      fetch: stubTwitch([], calls),
    });
    expect(await status.get()).toEqual({ state: "unavailable" });
    expect(calls).toHaveLength(0);
  });

  test("serves a cache hit within 60 seconds and refreshes after", async () => {
    const calls: Call[] = [];
    let now = 1000;
    const status = createLiveStatus({
      ...credentials,
      fetch: stubTwitch([], calls),
      now: () => now,
    });
    await status.get();
    const callsAfterFirst = calls.length;
    now += CACHE_TTL_MS - 1;
    await status.get();
    expect(calls).toHaveLength(callsAfterFirst);
    now += 2;
    await status.get();
    expect(calls.length).toBeGreaterThan(callsAfterFirst);
  });

  test("shares one upstream lookup between concurrent requests", async () => {
    const calls: Call[] = [];
    const status = createLiveStatus({
      ...credentials,
      fetch: stubTwitch([], calls),
    });
    await Promise.all([status.get(), status.get()]);
    expect(calls.filter((call) => call.url.includes("helix"))).toHaveLength(1);
  });

  test("sends the credentials only to Twitch", async () => {
    const calls: Call[] = [];
    const status = createLiveStatus({
      ...credentials,
      fetch: stubTwitch([], calls),
    });
    const payload = await status.get();
    expect(JSON.stringify(payload)).not.toContain("secret-xyz");
    expect(JSON.stringify(payload)).not.toContain("token-123");
    for (const call of calls) {
      expect(new URL(call.url).hostname).toMatch(/\.twitch\.tv$/);
    }
  });
});

describe("statusResponse", () => {
  test("wraps the payload as cacheable JSON", async () => {
    const response = statusResponse({ state: "offline" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({ state: "offline" });
  });
});
