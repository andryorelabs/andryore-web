import { SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";

/**
 * Builds `robots.txt` from the crawler policy in ADR 0013.
 * @param sitemapUrl Absolute URL of the sitemap.
 * @returns The file body, newline terminated.
 */
export function buildRobotsTxt(sitemapUrl: string): string {
  const allowed = SEARCH_CRAWLERS.map((agent) => `User-agent: ${agent}\nAllow: /`);
  const trained = TRAINING_CRAWLERS.map((agent) => `User-agent: ${agent}`);
  return [
    ...allowed,
    `${trained.join("\n")}\nDisallow: /`,
    "User-agent: *\nAllow: /",
    `Sitemap: ${sitemapUrl}`,
  ]
    .join("\n\n")
    .concat("\n");
}
