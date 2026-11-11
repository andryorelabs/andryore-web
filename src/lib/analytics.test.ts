import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ANALYTICS_EVENTS,
  analyticsAttributes,
  UMAMI_GATEWAY_ORIGIN,
  UMAMI_SCRIPT_ORIGIN,
  UMAMI_SCRIPT_URL,
} from "./analytics";

const CSP_TEMPLATE = readFileSync(
  path.join(import.meta.dir, "../../docker/security-headers.conf.template"),
  "utf8",
);

function directive(name: string): string[] {
  const policy = /Content-Security-Policy "([^"]*)"/.exec(CSP_TEMPLATE)?.[1];
  const entry = policy
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
  return entry?.split(/\s+/).slice(1) ?? [];
}

describe("analyticsAttributes", () => {
  test("emits the event name and one attribute per property", () => {
    expect(analyticsAttributes("theme-switch", { theme: "dark", from: "dock" })).toEqual({
      "data-umami-event": "theme-switch",
      "data-umami-event-theme": "dark",
      "data-umami-event-from": "dock",
    });
  });

  test("emits only the name without properties", () => {
    expect(analyticsAttributes("cv-download")).toEqual({
      "data-umami-event": "cv-download",
    });
  });

  test("keeps every event name kebab-case", () => {
    for (const name of Object.values(ANALYTICS_EVENTS)) {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

describe("content security policy template", () => {
  test("script-src adds exactly the Umami script origin", () => {
    expect(UMAMI_SCRIPT_URL.startsWith(UMAMI_SCRIPT_ORIGIN)).toBe(true);
    const origins = directive("script-src").filter((source) => source.startsWith("https://"));
    expect(origins).toEqual([UMAMI_SCRIPT_ORIGIN]);
  });

  test("connect-src adds exactly the Umami gateway origin", () => {
    const origins = directive("connect-src").filter((source) => source.startsWith("https://"));
    expect(origins).toEqual([UMAMI_GATEWAY_ORIGIN]);
  });

  test("never allows unsafe-inline or unsafe-eval", () => {
    expect(CSP_TEMPLATE).not.toContain("unsafe-");
  });
});
