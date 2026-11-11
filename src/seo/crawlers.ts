/**
 * Search and answer crawlers that `robots.txt` allows by name.
 * See ADR 0013.
 */
export const SEARCH_CRAWLERS: readonly string[] = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

/**
 * Model-training crawlers that `robots.txt` disallows. `Google-Extended` is
 * deliberately absent. See ADR 0013.
 */
export const TRAINING_CRAWLERS: readonly string[] = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
];
