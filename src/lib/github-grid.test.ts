import { describe, expect, test } from "bun:test";

import {
  fetchContributionGrid,
  parseContributionResponse,
  resolveGridSnapshot,
  type GridSnapshot,
} from "./github-grid";

const NOW = new Date("2026-10-17T10:00:00Z");

const apiBody = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 5,
          weeks: [
            {
              contributionDays: [
                {
                  date: "2026-10-11",
                  contributionCount: 0,
                  contributionLevel: "NONE",
                },
                {
                  date: "2026-10-12",
                  contributionCount: 5,
                  contributionLevel: "FOURTH_QUARTILE",
                },
              ],
            },
          ],
        },
      },
    },
  },
};

const committed: GridSnapshot = {
  capturedAt: "2026-01-01",
  total: 1,
  weeks: [[{ date: "2026-01-01", count: 1, level: 1 }]],
};

const respond =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(Response.json(body, { status }));

describe("parseContributionResponse", () => {
  test("maps the API calendar to a dated snapshot", () => {
    expect(parseContributionResponse(apiBody, NOW)).toEqual({
      capturedAt: "2026-10-17",
      total: 5,
      weeks: [
        [
          { date: "2026-10-11", count: 0, level: 0 },
          { date: "2026-10-12", count: 5, level: 4 },
        ],
      ],
    });
  });

  test("rejects a body without a calendar", () => {
    expect(parseContributionResponse({ errors: [{}] }, NOW)).toBeUndefined();
    expect(parseContributionResponse(null, NOW)).toBeUndefined();
  });
});

describe("fetchContributionGrid", () => {
  test("returns undefined without a token and never calls the API", async () => {
    let wasCalled = false;
    const result = await fetchContributionGrid({
      token: undefined,
      login: "AndryOre",
      now: NOW,
      fetchImpl: () => {
        wasCalled = true;
        return respond(apiBody)();
      },
    });
    expect(result).toBeUndefined();
    expect(wasCalled).toBe(false);
  });

  test("sends the token as a bearer header", async () => {
    let auth = "";
    await fetchContributionGrid({
      token: "secret",
      login: "AndryOre",
      now: NOW,
      fetchImpl: (_url, init) => {
        auth = new Headers(init?.headers).get("authorization") ?? "";
        return respond(apiBody)();
      },
    });
    expect(auth).toBe("Bearer secret");
  });

  test("returns undefined on an HTTP error, a bad body or a network failure", async () => {
    const base = { token: "secret", login: "AndryOre", now: NOW };
    expect(await fetchContributionGrid({ ...base, fetchImpl: respond({}, 502) })).toBeUndefined();
    expect(await fetchContributionGrid({ ...base, fetchImpl: respond({}) })).toBeUndefined();
    expect(
      await fetchContributionGrid({
        ...base,
        fetchImpl: () => Promise.reject(new Error("offline")),
      }),
    ).toBeUndefined();
  });
});

describe("resolveGridSnapshot", () => {
  const options = { login: "AndryOre", now: NOW };

  test("prefers a fresh fetch", async () => {
    const snapshot = await resolveGridSnapshot({
      ...options,
      token: "secret",
      fetchImpl: respond(apiBody),
      committed,
    });
    expect(snapshot?.capturedAt).toBe("2026-10-17");
  });

  test("falls back to the committed snapshot on a missing token", async () => {
    expect(
      await resolveGridSnapshot({
        ...options,
        token: undefined,
        fetchImpl: respond(apiBody),
        committed,
      }),
    ).toBe(committed);
  });

  test("falls back to the committed snapshot on an API error", async () => {
    expect(
      await resolveGridSnapshot({
        ...options,
        token: "secret",
        fetchImpl: respond({}, 500),
        committed,
      }),
    ).toBe(committed);
  });

  test("hides the tile when there is nothing to show", async () => {
    expect(
      await resolveGridSnapshot({
        ...options,
        token: undefined,
        fetchImpl: respond(apiBody),
        committed: undefined,
      }),
    ).toBeUndefined();
  });
});
