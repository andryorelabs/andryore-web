import { describe, expect, test } from "bun:test";

import {
  CONTRIBUTIONS_CACHE_TTL_MS,
  CONTRIBUTIONS_FAILURE_TTL_MS,
  contributionsResponse,
  createContributionsReader,
} from "./github-contributions";

const apiBody = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 3,
          weeks: [
            {
              contributionDays: [
                {
                  date: "2026-10-12",
                  contributionCount: 3,
                  contributionLevel: "SECOND_QUARTILE",
                },
              ],
            },
          ],
        },
      },
    },
  },
};

const stub = (calls: { count: number }, isOk = true) => {
  return () => {
    calls.count += 1;
    return Promise.resolve(isOk ? Response.json(apiBody) : new Response("no", { status: 502 }));
  };
};

describe("createContributionsReader", () => {
  test("returns the grid with the fetch moment", async () => {
    const reader = createContributionsReader({
      token: "t",
      fetch: stub({ count: 0 }),
      now: () => Date.parse("2026-10-18T10:00:00Z"),
    });
    const grid = await reader.get();
    expect(grid?.total).toBe(3);
    expect(grid?.updatedAt).toBe("2026-10-18T10:00:00.000Z");
  });

  test("returns undefined without calling GitHub when the token is missing", async () => {
    const calls = { count: 0 };
    const reader = createContributionsReader({
      token: undefined,
      fetch: stub(calls),
    });
    expect(await reader.get()).toBeUndefined();
    expect(calls.count).toBe(0);
  });

  test("serves a cache hit, then refreshes after an hour", async () => {
    const calls = { count: 0 };
    let clock = 0;
    const reader = createContributionsReader({
      token: "t",
      fetch: stub(calls),
      now: () => clock,
    });
    await reader.get();
    clock = CONTRIBUTIONS_CACHE_TTL_MS - 1;
    await reader.get();
    expect(calls.count).toBe(1);
    clock = CONTRIBUTIONS_CACHE_TTL_MS + 1;
    await reader.get();
    expect(calls.count).toBe(2);
  });

  test("returns undefined on an upstream error and retries after the failure ttl", async () => {
    const calls = { count: 0 };
    let clock = 0;
    const reader = createContributionsReader({
      token: "t",
      fetch: stub(calls, false),
      now: () => clock,
    });
    expect(await reader.get()).toBeUndefined();
    await reader.get();
    expect(calls.count).toBe(1);
    clock = CONTRIBUTIONS_FAILURE_TTL_MS + 1;
    await reader.get();
    expect(calls.count).toBe(2);
  });

  test("shares one in-flight request", async () => {
    const calls = { count: 0 };
    const reader = createContributionsReader({ token: "t", fetch: stub(calls) });
    await Promise.all([reader.get(), reader.get()]);
    expect(calls.count).toBe(1);
  });
});

describe("contributionsResponse", () => {
  test("answers 503 when there is no grid", () => {
    const response = contributionsResponse(undefined);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("answers 200 with the grid as JSON", async () => {
    const response = contributionsResponse({
      capturedAt: "2026-10-18",
      total: 1,
      weeks: [],
      updatedAt: "2026-10-18T10:00:00.000Z",
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { total: number }).total).toBe(1);
  });
});
