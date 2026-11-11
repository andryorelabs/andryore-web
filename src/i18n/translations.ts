import { createHash } from "node:crypto";

import { DEFAULT_LOCALE, type Locale } from "./locales";

export interface TranslatedEntry {
  id: string;
  lang: Locale;
  key: string;
  title: string;
  body: string;
  sourceHash?: string;
}

interface Pair {
  source: TranslatedEntry;
  translation: TranslatedEntry;
}

const HASH_LENGTH = 12;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const CODE_FENCE = /^(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm;

/**
 * Splits a Markdown file into its frontmatter and body.
 * @param raw The whole file text.
 * @returns The frontmatter text without fences and the body after it.
 */
export function splitFrontmatter(raw: string): {
  frontmatter: string;
  body: string;
} {
  const match = FRONTMATTER.exec(raw);
  return match
    ? { frontmatter: match[1] ?? "", body: raw.slice(match[0].length) }
    : { frontmatter: "", body: raw };
}

/**
 * Fingerprint of an English source body, stored in the Spanish entry as
 * `sourceHash` so a later edit of the source marks the translation stale.
 * @param body The Markdown body of the English entry.
 * @returns The first twelve hex characters of its SHA-256.
 */
export function sourceHash(body: string): string {
  const normalized = body.replaceAll("\r\n", "\n").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, HASH_LENGTH);
}

/**
 * Extracts the fenced code blocks of a Markdown body.
 * @param body The Markdown body.
 * @returns Each block verbatim, fences included, in order.
 */
export function codeFences(body: string): string[] {
  return body.replaceAll("\r\n", "\n").match(CODE_FENCE) ?? [];
}

function pairsWithSource(entries: readonly TranslatedEntry[]): Pair[] {
  const pairs: Pair[] = [];
  for (const translation of entries) {
    if (translation.lang === DEFAULT_LOCALE) continue;
    const source = entries.find(
      (candidate) => candidate.lang === DEFAULT_LOCALE && candidate.key === translation.key,
    );
    if (source) pairs.push({ source, translation });
  }
  return pairs;
}

/**
 * Finds translations whose code blocks differ from the English source.
 * @param entries Every entry of a collection.
 * @returns One message per translation with a differing code block.
 */
export function findFenceMismatches(entries: readonly TranslatedEntry[]): string[] {
  return pairsWithSource(entries)
    .filter(
      ({ source, translation }) =>
        codeFences(source.body).join("\0") !== codeFences(translation.body).join("\0"),
    )
    .map(
      ({ source, translation }) =>
        `Content entry "${translation.key}" (${translation.id}): code blocks differ from the "${source.lang}" source (${source.id}); they must stay byte-identical.`,
    );
}

/**
 * Finds translations that were written against an older English source.
 * @param entries Every entry of a collection.
 * @returns One message per stale or unhashed translation.
 */
export function findStaleTranslations(entries: readonly TranslatedEntry[]): string[] {
  return pairsWithSource(entries).flatMap(({ source, translation }) => {
    const expected = sourceHash(source.body);
    if (translation.sourceHash === undefined) {
      return `Content entry "${translation.key}" (${translation.id}) has no sourceHash; set it to "${expected}".`;
    }
    return translation.sourceHash === expected
      ? []
      : `Content entry "${translation.key}" (${translation.id}) is stale: its "${source.lang}" source (${source.id}) changed after the translation.`;
  });
}

/**
 * Finds entries of one language that share a title.
 * @param entries Every entry of a collection.
 * @returns One message per colliding pair.
 */
export function findDuplicateTitles(entries: readonly TranslatedEntry[]): string[] {
  return entries.flatMap((entry, index) =>
    entries
      .slice(index + 1)
      .filter((other) => other.lang === entry.lang && other.title === entry.title)
      .map(
        (other) =>
          `Content entries "${entry.id}" and "${other.id}" share the "${entry.lang}" title "${entry.title}".`,
      ),
  );
}
