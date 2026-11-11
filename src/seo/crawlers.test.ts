import { describe, expect, test } from "bun:test";

import { SEARCH_CRAWLERS, TRAINING_CRAWLERS } from "./crawlers";

describe("crawler lists (ADR 0013)", () => {
  test("allow the search and answer crawlers", () => {
    expect(SEARCH_CRAWLERS).toEqual([
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Perplexity-User",
    ]);
  });

  test("disallow the training crawlers", () => {
    expect(TRAINING_CRAWLERS).toEqual([
      "GPTBot",
      "ClaudeBot",
      "CCBot",
      "Applebot-Extended",
      "Bytespider",
    ]);
  });

  test("leave Google-Extended out of both lists", () => {
    expect([...SEARCH_CRAWLERS, ...TRAINING_CRAWLERS]).not.toContain("Google-Extended");
  });
});
