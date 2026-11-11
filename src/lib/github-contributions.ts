import { fetchContributionGrid, type FetchOptions, type GridSnapshot } from "./github-grid";

/**
The GitHub account whose contributions the tile shows.
 */
export const GITHUB_LOGIN = "AndryOre";

/**
How long a good answer is reused, in milliseconds (ADR 0017).
 */
export const CONTRIBUTIONS_CACHE_TTL_MS = 3_600_000;

/**
How long a failure is remembered, so GitHub is not hammered while down.
 */
export const CONTRIBUTIONS_FAILURE_TTL_MS = 60_000;

/**
The endpoint payload: the grid plus the exact moment it was fetched.
 */
export interface LiveGridSnapshot extends GridSnapshot {
  /**
  Full ISO timestamp of the upstream fetch.
   */
  updatedAt: string;
}

/**
Options for {@link createContributionsReader}.
 */
export interface ContributionsReaderOptions {
  token: string | undefined;
  login?: string;
  fetch?: FetchOptions["fetchImpl"];
  now?: () => number;
}

/**
Reads the cached grid, refreshing it from GitHub at most once an hour.
 */
export interface ContributionsReader {
  get: () => Promise<LiveGridSnapshot | undefined>;
}

/**
 * Creates the server-side contribution grid reader. A missing token or any
 * upstream failure resolves to undefined; it never rejects and never exposes the
 * token.
 * @param options Token, optional account, fetch and clock overrides.
 * @returns A reader whose good answers are cached for one hour.
 */
export function createContributionsReader(
  options: ContributionsReaderOptions,
): ContributionsReader {
  const request = options.fetch ?? ((url, init) => fetch(url, init));
  const now = options.now ?? Date.now;
  let cached: { value: LiveGridSnapshot | undefined; expiresAt: number } | undefined;
  let pending: Promise<LiveGridSnapshot | undefined> | undefined;

  const refresh = async (): Promise<LiveGridSnapshot | undefined> => {
    const moment = new Date(now());
    const snapshot = await fetchContributionGrid({
      token: options.token,
      login: options.login ?? GITHUB_LOGIN,
      now: moment,
      fetchImpl: request,
    });
    const value = snapshot ? { ...snapshot, updatedAt: moment.toISOString() } : undefined;
    const ttl = value ? CONTRIBUTIONS_CACHE_TTL_MS : CONTRIBUTIONS_FAILURE_TTL_MS;
    cached = { value, expiresAt: now() + ttl };
    return value;
  };

  return {
    get: async () => {
      if (!options.token) return;
      if (cached && cached.expiresAt > now()) return cached.value;
      pending ??= refresh();
      try {
        return await pending;
      } finally {
        pending = undefined;
      }
    },
  };
}

/**
 * Wraps the reader's answer as the endpoint's JSON response.
 * @param snapshot The grid, or undefined when it is unavailable.
 * @returns 200 with the grid, or 503 so the tile keeps its build snapshot.
 */
export function contributionsResponse(snapshot: LiveGridSnapshot | undefined): Response {
  return snapshot
    ? Response.json(snapshot, {
        headers: { "Cache-Control": "public, max-age=300" },
      })
    : Response.json(
        { error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
}
