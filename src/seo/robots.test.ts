import { describe, expect, test } from "bun:test";

import { SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";
import { buildRobotsTxt } from "./robots";

const sitemapUrl = "https://andryore.dev/sitemap.xml";
const robots = buildRobotsTxt(sitemapUrl);

describe("buildRobotsTxt", () => {
  test("gives every search crawler an explicit allow group", () => {
    for (const agent of SEARCH_CRAWLERS) {
      expect(robots).toContain(`User-agent: ${agent}\nAllow: /\n`);
    }
  });

  test("disallows training crawlers in one group", () => {
    const group = TRAINING_CRAWLERS.map((agent) => `User-agent: ${agent}`).join("\n");
    expect(robots).toContain(`${group}\nDisallow: /\n`);
  });

  test("never mentions Google-Extended", () => {
    expect(robots).not.toContain("Google-Extended");
  });

  test("allows everyone else and points at the sitemap", () => {
    expect(robots).toContain("User-agent: *\nAllow: /\n");
    expect(robots.endsWith(`Sitemap: ${sitemapUrl}\n`)).toBe(true);
  });
});
