/**
 * The Twitch channel the Live status reports on.
 */
const CHANNEL_LOGIN = "andryoredev";

/**
 * How long an answer is reused, in milliseconds (ADR 0004).
 */
export const CACHE_TTL_MS = 60_000;

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const STREAMS_URL = "https://api.twitch.tv/helix/streams";
const TOKEN_SAFETY_MS = 60_000;

/**
 * The small payload the endpoint returns and the tile renders.
 */
export type StreamStatus =
  | { state: "live"; title: string }
  | { state: "offline" }
  | { state: "unavailable" };

/**
 * The subset of `fetch` the service needs, so tests can stub Twitch.
 */
export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Options for {@link createLiveStatus}.
 */
export interface LiveStatusOptions {
  clientId: string | undefined;
  clientSecret: string | undefined;
  fetch?: FetchLike;
  now?: () => number;
}

/**
 * Reads the cached Live status, refreshing it from Twitch at most once a minute.
 */
export interface LiveStatus {
  get: () => Promise<StreamStatus>;
}

interface Token {
  value: string;
  expiresAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Creates the server-side Live status reader for the Twitch channel.
 * Any upstream failure resolves to offline and missing credentials to
 * unavailable; it never rejects and never returns credentials.
 * @param options Credentials and optional fetch and clock overrides.
 * @returns A reader whose answers are cached for 60 seconds.
 */
export function createLiveStatus(options: LiveStatusOptions): LiveStatus {
  const request: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const now = options.now ?? Date.now;
  const { clientId, clientSecret } = options;

  let token: Token | undefined;
  let cached: { status: StreamStatus; expiresAt: number } | undefined;
  let pending: Promise<StreamStatus> | undefined;

  const getToken = async (id: string, secret: string): Promise<string> => {
    if (token && token.expiresAt > now()) return token.value;
    const query = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    });
    const response = await request(`${TOKEN_URL}?${query}`, { method: "POST" });
    const body: unknown = await response.json();
    if (
      !response.ok ||
      !isRecord(body) ||
      typeof body.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      throw new Error("Twitch token request failed");
    }
    token = {
      value: body.access_token,
      expiresAt: now() + body.expires_in * 1000 - TOKEN_SAFETY_MS,
    };
    return token.value;
  };

  const lookup = async (id: string, secret: string): Promise<StreamStatus> => {
    const accessToken = await getToken(id, secret);
    const response = await request(
      `${STREAMS_URL}?${new URLSearchParams({ user_login: CHANNEL_LOGIN })}`,
      { headers: { "Client-Id": id, Authorization: `Bearer ${accessToken}` } },
    );
    if (response.status === 401) token = undefined;
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || !Array.isArray(body.data)) {
      throw new Error("Twitch streams request failed");
    }
    const stream: unknown = body.data[0];
    if (isRecord(stream) && stream.type === "live") {
      return {
        state: "live",
        title: typeof stream.title === "string" ? stream.title : "",
      };
    }
    return { state: "offline" };
  };

  const refresh = async (id: string, secret: string): Promise<StreamStatus> => {
    let status: StreamStatus;
    try {
      status = await lookup(id, secret);
    } catch {
      status = { state: "offline" };
    }
    cached = { status, expiresAt: now() + CACHE_TTL_MS };
    return status;
  };

  return {
    get: async () => {
      if (!clientId || !clientSecret) return { state: "unavailable" };
      if (cached && cached.expiresAt > now()) return cached.status;
      pending ??= refresh(clientId, clientSecret);
      try {
        return await pending;
      } finally {
        pending = undefined;
      }
    },
  };
}

/**
 * Wraps a status as the endpoint's JSON response.
 * @param status The payload to serve.
 * @returns A response the browser and any proxy may reuse for 60 seconds.
 */
export function statusResponse(status: StreamStatus): Response {
  return Response.json(status, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
