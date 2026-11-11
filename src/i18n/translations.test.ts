import { describe, expect, test } from "bun:test";

import {
  codeFences,
  findDuplicateTitles,
  findFenceMismatches,
  findStaleTranslations,
  sourceHash,
  splitFrontmatter,
  type TranslatedEntry,
} from "./translations";

const entry = (overrides: Partial<TranslatedEntry>): TranslatedEntry => ({
  id: "log/en/a.md",
  lang: "en",
  key: "a",
  title: "A",
  body: "Hello",
  ...overrides,
});

const spanish = (overrides: Partial<TranslatedEntry>): TranslatedEntry =>
  entry({ lang: "es", id: "log/es/a.md", ...overrides });

const fenced = (code: string): string => `text\n\n\`\`\`\n${code}\n\`\`\`\n`;

describe("sourceHash", () => {
  test("ignores line endings and surrounding whitespace", () => {
    expect(sourceHash("one\r\ntwo\n")).toBe(sourceHash("\none\ntwo"));
  });

  test("changes when the text changes", () => {
    expect(sourceHash("one")).not.toBe(sourceHash("two"));
  });

  test("is twelve hex characters", () => {
    expect(sourceHash("one")).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("splitFrontmatter", () => {
  test("separates the frontmatter from the body", () => {
    expect(splitFrontmatter("---\nlang: en\n---\nBody\n")).toEqual({
      frontmatter: "lang: en",
      body: "Body\n",
    });
  });

  test("treats a file without frontmatter as all body", () => {
    expect(splitFrontmatter("Body")).toEqual({ frontmatter: "", body: "Body" });
  });
});

describe("codeFences", () => {
  test("extracts fenced blocks verbatim", () => {
    const body = "text\n\n```ts\nconst a = 1\n```\n\nmore\n\n```\nx\n```\n";
    expect(codeFences(body)).toEqual(["```ts\nconst a = 1\n```", "```\nx\n```"]);
  });
});

const pair = (
  english: Partial<TranslatedEntry>,
  translation: Partial<TranslatedEntry>,
): TranslatedEntry[] => [entry(english), spanish(translation)];

describe("findFenceMismatches", () => {
  test("accepts byte-identical code blocks", () => {
    const entries = pair({ body: fenced("a") }, { body: fenced("a") });
    expect(findFenceMismatches(entries)).toEqual([]);
  });

  test("flags a translated code block", () => {
    const entries = pair({ body: fenced("a") }, { body: fenced("b") });
    expect(findFenceMismatches(entries)).toEqual([
      'Content entry "a" (log/es/a.md): code blocks differ from the "en" source (log/en/a.md); they must stay byte-identical.',
    ]);
  });
});

describe("findStaleTranslations", () => {
  test("accepts a Spanish entry whose hash matches the English body", () => {
    const hash = sourceHash("Hello");
    const entries = pair({ body: "Hello" }, { sourceHash: hash });
    expect(findStaleTranslations(entries)).toEqual([]);
  });

  test("flags a Spanish entry written against an older source", () => {
    const hash = sourceHash("Hello");
    const entries = pair({ body: "Hello again" }, { sourceHash: hash });
    expect(findStaleTranslations(entries)).toEqual([
      'Content entry "a" (log/es/a.md) is stale: its "en" source (log/en/a.md) changed after the translation.',
    ]);
  });

  test("flags a Spanish entry with no stored hash", () => {
    const hash = sourceHash("Hello");
    expect(findStaleTranslations(pair({}, {}))).toEqual([
      `Content entry "a" (log/es/a.md) has no sourceHash; set it to "${hash}".`,
    ]);
  });
});

describe("findDuplicateTitles", () => {
  test("flags two entries of one language sharing a title", () => {
    expect(
      findDuplicateTitles([entry({ key: "a" }), entry({ key: "b", id: "log/en/b.md" })]),
    ).toEqual(['Content entries "log/en/a.md" and "log/en/b.md" share the "en" title "A".']);
  });

  test("allows the same title across languages", () => {
    expect(findDuplicateTitles([entry({}), spanish({})])).toEqual([]);
  });
});
