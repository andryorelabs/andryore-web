import { LOCALES, type Locale } from "./locales";

type Messages = Readonly<Record<string, string>>;

export type MessagesByLocale = Readonly<Partial<Record<Locale, Messages>>>;

export interface ContentEntry {
  id: string;
  lang: Locale;
  key: string;
}

interface ScanFrame {
  keys: Set<string> | undefined;
  expectKey: boolean;
}

const compareText = (left: string, right: string): number => left.localeCompare(right);

const PLACEHOLDER = /\{[^{}]+\}/g;
const LEAKED_TODO = /\b(?:TODO|FIXME|TBD)\b|\b[Ll]orem [Ii]psum\b/;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;

function routeOfPageFile(file: string): string | undefined {
  if (!file.endsWith(".astro") || file.includes("[")) return undefined;
  const stem = file.slice(0, -".astro".length);
  if (stem === "index") return "/";
  return stem.endsWith("/index") ? `/${stem.slice(0, -"index".length)}` : `/${stem}/`;
}

/**
 * Groups page files by language and maps them to locale-neutral paths.
 * @param files Page files relative to `src/pages`, forward-slash separated.
 *   Endpoints and dynamic routes are ignored.
 * @returns The sorted page paths of each language.
 */
export function pageRoutesFromFiles(files: readonly string[]): Record<Locale, string[]> {
  const routesOf = (isSpanish: boolean): string[] =>
    files
      .filter((file) => file.startsWith("es/") === isSpanish)
      .flatMap((file) => routeOfPageFile(isSpanish ? file.slice("es/".length) : file) ?? [])
      .toSorted(compareText);
  return { en: routesOf(false), es: routesOf(true) };
}

/**
 * Finds pages that exist in one language but not the other.
 * @param files Page files relative to `src/pages`.
 * @returns One message per unpaired page.
 */
export function findMissingPagePairs(files: readonly string[]): string[] {
  const routes = pageRoutesFromFiles(files);
  return LOCALES.flatMap((present) =>
    LOCALES.filter((missing) => missing !== present).flatMap((missing) =>
      routes[present]
        .filter((route) => !routes[missing].includes(route))
        .map((route) => `Page ${route} exists in "${present}" but has no "${missing}" pair.`),
    ),
  );
}

/**
 * Finds content entries whose translation is missing, pairing by shared key.
 * @param entries Every entry of a collection with its language and key.
 * @returns One message per missing translation.
 */
export function findMissingEntryPairs(entries: readonly ContentEntry[]): string[] {
  return entries.flatMap((entry) =>
    LOCALES.filter(
      (lang) =>
        lang !== entry.lang &&
        entries.every((other) => !(other.lang === lang && other.key === entry.key)),
    ).map((lang) => `Content entry "${entry.key}" (${entry.id}) has no "${lang}" translation.`),
  );
}

/**
 * Flattens nested string objects into dot-separated keys, so grouped copy
 * such as `theme.auto` takes part in key and placeholder parity.
 * @param value A parsed JSON object whose leaves are strings.
 * @param prefix Key path of `value`, empty at the root.
 * @returns Every string leaf by its dotted key; non-string leaves are skipped.
 */
export function flattenMessages(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  return typeof value !== "object" || value === null
    ? {}
    : Object.fromEntries(
        Object.entries(value).flatMap(([key, child]) =>
          Object.entries(flattenMessages(child, prefix ? `${prefix}.${key}` : key)),
        ),
      );
}

function placeholdersOf(message: string): string {
  return (message.match(PLACEHOLDER) ?? []).toSorted(compareText).join(" ");
}

function missingKeyProblems(
  file: string,
  messages: MessagesByLocale,
  present: Locale,
  missing: Locale,
): string[] {
  const target = messages[missing] ?? {};
  return Object.keys(messages[present] ?? {})
    .filter((key) => !Object.hasOwn(target, key))
    .map((key) => `${file}: key "${key}" is missing in "${missing}".`);
}

function placeholderProblems(file: string, messages: MessagesByLocale): string[] {
  const spanish = messages.es ?? {};
  return Object.entries(messages.en ?? {})
    .filter(
      ([key, english]) =>
        Object.hasOwn(spanish, key) &&
        placeholdersOf(english) !== placeholdersOf(spanish[key] ?? ""),
    )
    .map(([key]) => `${file}: key "${key}" has different placeholders in "en" and "es".`);
}

/**
 * Checks UI strings for key parity and placeholder parity between languages.
 * @param file Name of the string file, for messages.
 * @param messages The strings of each language.
 * @returns One message per problem.
 */
export function messageProblems(file: string, messages: MessagesByLocale): string[] {
  return [
    ...missingKeyProblems(file, messages, "en", "es"),
    ...missingKeyProblems(file, messages, "es", "en"),
    ...placeholderProblems(file, messages),
  ];
}

function endOfJsonString(raw: string, start: number): number {
  let end = start + 1;
  while (raw.charAt(end) !== '"' && end < raw.length) {
    end += raw.charAt(end) === "\\" ? 2 : 1;
  }
  return end;
}

function consumeToken(
  raw: string,
  index: number,
  stack: ScanFrame[],
  duplicates: string[],
): number {
  const char = raw.charAt(index);
  const top = stack.at(-1);
  switch (char) {
    case '"': {
      const end = endOfJsonString(raw, index);
      if (top?.keys && top.expectKey) {
        const key = raw.slice(index + 1, end);
        if (top.keys.has(key)) duplicates.push(key);
        top.keys.add(key);
        top.expectKey = false;
      }
      return end + 1;
    }
    case "{": {
      stack.push({ keys: new Set(), expectKey: true });
      return index + 1;
    }
    case "[": {
      stack.push({ keys: undefined, expectKey: false });
      return index + 1;
    }
    case "}":
    case "]": {
      stack.pop();
      return index + 1;
    }
    default: {
      if (char === "," && top?.keys) top.expectKey = true;
      return index + 1;
    }
  }
}

/**
 * Finds keys repeated inside one JSON object, which `JSON.parse` silently
 * collapses.
 * @param raw The raw JSON text.
 * @returns The repeated keys.
 */
export function findDuplicateJsonKeys(raw: string): string[] {
  const duplicates: string[] = [];
  const stack: ScanFrame[] = [];
  let index = 0;
  while (index < raw.length) {
    index = consumeToken(raw, index, stack, duplicates);
  }
  return duplicates;
}

/**
 * Finds string keys that no source file mentions.
 * @param keys The keys defined in a string file.
 * @param sources The text of the files that may use them.
 * @returns The keys that appear in none of the sources.
 */
export function findUnusedKeys(keys: readonly string[], sources: readonly string[]): string[] {
  return keys.filter((key) =>
    sources.every((source) => !new RegExp(String.raw`\b${key}\b`).test(source)),
  );
}

/**
 * Lints copy for leaked placeholders and over-long meta text.
 * @param file Name of the string file, for messages.
 * @param messages The strings of each language.
 * @returns One message per problem.
 */
export function lintCopy(file: string, messages: MessagesByLocale): string[] {
  const limits: Record<string, number> = {
    title: MAX_TITLE_LENGTH,
    description: MAX_DESCRIPTION_LENGTH,
  };
  return Object.entries(messages).flatMap(([locale, strings]) =>
    Object.entries(strings).flatMap(([key, value]) => {
      const problems: string[] = [];
      if (LEAKED_TODO.test(value)) {
        problems.push(`${file}: "${locale}.${key}" contains a leaked TODO.`);
      }
      const limit = limits[key];
      if (limit !== undefined && value.length > limit) {
        problems.push(
          `${file}: "${locale}.${key}" is ${String(value.length)} characters, over the ${String(limit)} limit.`,
        );
      }
      return problems;
    }),
  );
}
