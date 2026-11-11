import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { LOCALES, type Locale } from "./locales";
import {
  findDuplicateJsonKeys,
  findMissingEntryPairs,
  findMissingPagePairs,
  findUnusedKeys,
  flattenMessages,
  lintCopy,
  messageProblems,
  type ContentEntry,
  type MessagesByLocale,
} from "./parity";
import { translationProblems } from "./translated-entries";

const SOURCE_FILE = /\.(?:astro|tsx?|mjs)$/;
const TEST_FILE = /\.test\.(?:tsx?|mjs)$/;

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : absolute;
  });
}

function relativeTo(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function frontmatterField(frontmatter: string, name: string): string | undefined {
  const pattern = new RegExp(String.raw`^${name}:\s*["']?([^"'\r\n]+?)["']?\s*$`, "m");
  return pattern.exec(frontmatter)?.[1];
}

function parseEntry(root: string, file: string): ContentEntry | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf8"))?.[1] ?? "";
  const lang = frontmatterField(frontmatter, "lang");
  const key = frontmatterField(frontmatter, "key");
  const locale = LOCALES.find((candidate) => candidate === lang);
  return locale && key ? { id: relativeTo(root, file), lang: locale, key } : undefined;
}

function isMessagesFile(value: unknown): value is MessagesByLocale {
  return (
    typeof value === "object" &&
    value !== null &&
    LOCALES.every((locale: Locale) => Object.hasOwn(value, locale))
  );
}

function jsonProblems(root: string, file: string, sources: readonly string[]): string[] {
  const raw = readFileSync(file, "utf8");
  const name = relativeTo(root, file);
  const problems = findDuplicateJsonKeys(raw).map((key) => `${name}: duplicate key "${key}".`);
  const parsed: unknown = JSON.parse(raw);
  if (!isMessagesFile(parsed)) return problems;
  const unused = findUnusedKeys(Object.keys(parsed.en ?? {}), sources).map(
    (key) => `${name}: key "${key}" is not used by any source file.`,
  );
  const flat = {
    en: flattenMessages(parsed.en),
    es: flattenMessages(parsed.es),
  };
  return [...problems, ...messageProblems(name, flat), ...lintCopy(name, flat), ...unused];
}

/**
 * Runs every bilingual parity check against a source tree: page pairs,
 * content entry pairs, and, for each `src/content/*.json` string file, key
 * parity, placeholder parity, duplicate keys, unused keys and the copy lint.
 * @param root Absolute path of the repository root.
 * @returns One message per problem; empty when the site is in parity.
 */
export function runParityCheck(root: string): string[] {
  const source = path.join(root, "src");
  const pagesRoot = path.join(source, "pages");
  const pageFiles = listFiles(pagesRoot).map((file) => relativeTo(pagesRoot, file));
  const contentFiles = listFiles(path.join(source, "content"));
  const entries = contentFiles
    .filter((file) => file.endsWith(".md"))
    .flatMap((file) => parseEntry(root, file) ?? []);
  const sources = listFiles(source)
    .filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
    .map((file) => readFileSync(file, "utf8"));
  const stringFiles = contentFiles.filter((file) => file.endsWith(".json"));
  return [
    ...findMissingPagePairs(pageFiles),
    ...findMissingEntryPairs(entries),
    ...translationProblems(root),
    ...stringFiles.flatMap((file) => jsonProblems(root, file, sources)),
  ];
}
