const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

type GridLevel = 0 | 1 | 2 | 3 | 4;

const LEVELS: Readonly<Record<string, GridLevel>> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

/**
One calendar day of the contribution grid.
 */
export interface GridDay {
  date: string;
  count: number;
  level: GridLevel;
}

/**
A year of contributions as captured at build time.
 */
export interface GridSnapshot {
  /**
  ISO date (UTC) the data was fetched.
   */
  capturedAt: string;
  total: number;
  weeks: GridDay[][];
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetchOptions {
  token: string | undefined;
  login: string;
  now: Date;
  fetchImpl: FetchLike;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && Boolean(value);

const toDay = (raw: unknown): GridDay | undefined => {
  if (!isRecord(raw)) return undefined;
  const { date, contributionCount, contributionLevel } = raw;
  const level = LEVELS[String(contributionLevel)];
  return typeof date !== "string" || typeof contributionCount !== "number" || level === undefined
    ? undefined
    : { date, count: contributionCount, level };
};

/**
 * Turns a GitHub GraphQL response into a snapshot.
 * @param body The parsed JSON body of the response.
 * @param now The capture moment, stored as an ISO date.
 * @returns The snapshot, or undefined when the body has no usable calendar.
 */
export function parseContributionResponse(body: unknown, now: Date): GridSnapshot | undefined {
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.user)) {
    return undefined;
  }
  const collection = body.data.user.contributionsCollection;
  if (!isRecord(collection) || !isRecord(collection.contributionCalendar)) {
    return undefined;
  }
  const { totalContributions, weeks } = collection.contributionCalendar;
  if (typeof totalContributions !== "number" || !Array.isArray(weeks)) {
    return undefined;
  }
  const parsed = (weeks as unknown[]).map((week) =>
    isRecord(week) && Array.isArray(week.contributionDays)
      ? (week.contributionDays as unknown[]).map((day) => toDay(day))
      : [undefined],
  );
  if (parsed.some((week) => week.includes(undefined))) return undefined;
  return {
    capturedAt: now.toISOString().slice(0, 10),
    total: totalContributions,
    weeks: parsed as GridDay[][],
  };
}

/**
 * Fetches the last year of contributions. It never throws: any failure,
 * including a missing token, resolves to undefined so the build keeps going.
 * @param options Token, account, clock and fetch implementation.
 * @returns A fresh snapshot, or undefined.
 */
export async function fetchContributionGrid(
  options: FetchOptions,
): Promise<GridSnapshot | undefined> {
  if (!options.token) return undefined;
  try {
    const response = await options.fetchImpl(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { login: options.login },
      }),
    });
    return response.ok ? parseContributionResponse(await response.json(), options.now) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Picks the snapshot the tile renders: fresh data when the fetch works,
 * otherwise the last committed snapshot, otherwise nothing (tile hidden).
 * @param options Fetch options plus the committed snapshot, if any.
 * @returns The snapshot to render, or undefined to hide the tile.
 */
export async function resolveGridSnapshot(
  options: FetchOptions & { committed: GridSnapshot | undefined },
): Promise<GridSnapshot | undefined> {
  return (await fetchContributionGrid(options)) ?? options.committed;
}
