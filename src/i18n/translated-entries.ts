import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { LOCALES } from "./locales";
import {
  findDuplicateTitles,
  findFenceMismatches,
  splitFrontmatter,
  type TranslatedEntry,
} from "./translations";

function listMarkdown(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdown(absolute);
    return entry.name.endsWith(".md") ? absolute : [];
  });
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.startsWith("'") && value.endsWith("'") && value.length > 1
    ? value.slice(1, -1).replaceAll("''", "'")
    : value;
}

/**
 * Reads one single-line scalar from YAML frontmatter.
 * @param frontmatter The frontmatter text without its fences.
 * @param name The field name.
 * @returns The unquoted value, or undefined when the field is absent.
 */
export function frontmatterValue(frontmatter: string, name: string): string | undefined {
  const line = new RegExp(String.raw`^${name}:[ \t]*(.+?)[ \t]*$`, "m").exec(frontmatter);
  return line?.[1] === undefined ? undefined : unquote(line[1]);
}

function toEntry(root: string, file: string): TranslatedEntry | undefined {
  const { frontmatter, body } = splitFrontmatter(readFileSync(file, "utf8"));
  const lang = LOCALES.find((candidate) => candidate === frontmatterValue(frontmatter, "lang"));
  const key = frontmatterValue(frontmatter, "key");
  const title = frontmatterValue(frontmatter, "title");
  if (!lang || !key || title === undefined) return undefined;
  const hash = frontmatterValue(frontmatter, "sourceHash");
  return {
    id: path.relative(root, file).split(path.sep).join("/"),
    lang,
    key,
    title,
    body,
    ...(hash !== undefined && { sourceHash: hash }),
  };
}

/**
 * Reads every Markdown content entry under `src/content`.
 * @param root Absolute path of the repository root.
 * @returns The entries that declare a language, a key and a title, by path.
 */
export function readTranslatedEntries(root: string): TranslatedEntry[] {
  return listMarkdown(path.join(root, "src", "content"))
    .toSorted((left, right) => left.localeCompare(right))
    .flatMap((file) => toEntry(root, file) ?? []);
}

/**
 * Problems of content translations that fail the build: duplicate titles per
 * language and code blocks that differ from the English source.
 * @param root Absolute path of the repository root.
 * @returns One message per problem.
 */
export function translationProblems(root: string): string[] {
  const entries = readTranslatedEntries(root);
  return [...findDuplicateTitles(entries), ...findFenceMismatches(entries)];
}
