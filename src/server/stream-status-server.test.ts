import { afterEach, describe, expect, spyOn, test } from "bun:test";

type RouteHandler = () => Promise<Response>;

interface ServeOptions {
  port: number;
  routes: Record<string, RouteHandler>;
  fetch: () => Response;
}

const CLEARED_KEYS = [
  "DOTENV_PRIVATE_KEY",
  "GITHUB_TOKEN",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
] as const;

describe("stream status server", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      Reflect.deleteProperty(process.env, key);
    }
    Object.assign(process.env, snapshot);
  });

  test("binds the configured port and serves both routes without credentials", async () => {
    process.env.PORT = "4321";
    for (const key of CLEARED_KEYS) Reflect.deleteProperty(process.env, key);
    const serve = spyOn(Bun, "serve").mockImplementation((() => ({})) as never);

    await import("./stream-status-server");

    const options = serve.mock.calls[0]?.[0] as unknown as ServeOptions;
    serve.mockRestore();
    expect(options.port).toBe(4321);
    expect(Object.keys(options.routes)).toEqual([
      "/api/stream-status",
      "/api/github-contributions",
    ]);
    for (const handler of Object.values(options.routes)) {
      const response = await handler();
      expect(response.status).toBeGreaterThanOrEqual(200);
    }
    const fallback = options.fetch();
    expect(fallback.status).toBe(404);
    expect(await fallback.text()).toBe("Not found");
  });
});
