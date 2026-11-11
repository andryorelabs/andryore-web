import { describe, expect, test } from "bun:test";

import {
  findDuplicateJsonKeys,
  findMissingEntryPairs,
  findMissingPagePairs,
  findUnusedKeys,
  flattenMessages,
  lintCopy,
  messageProblems,
  pageRoutesFromFiles,
} from "./parity";

describe("pageRoutesFromFiles", () => {
  test("maps page files to locale-neutral paths per language", () => {
    expect(
      pageRoutesFromFiles([
        "index.astro",
        "about/index.astro",
        "es/index.astro",
        "es/about/index.astro",
        "sitemap.xml.ts",
      ]),
    ).toEqual({ en: ["/", "/about/"], es: ["/", "/about/"] });
  });

  test("maps flat page files to a directory path", () => {
    expect(pageRoutesFromFiles(["about.astro", "es/about.astro"])).toEqual({
      en: ["/about/"],
      es: ["/about/"],
    });
  });
});

describe("findMissingPagePairs", () => {
  test("passes when every page has its pair", () => {
    expect(
      findMissingPagePairs([
        "index.astro",
        "es/index.astro",
        "about/index.astro",
        "es/about/index.astro",
      ]),
    ).toEqual([]);
  });

  test("names the Spanish page that is missing", () => {
    const problems = findMissingPagePairs(["index.astro", "es/index.astro", "about/index.astro"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/about/");
    expect(problems[0]).toContain("es");
  });

  test("names the English page that is missing", () => {
    const problems = findMissingPagePairs([
      "index.astro",
      "es/index.astro",
      "es/about/index.astro",
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/about/");
    expect(problems[0]).toContain("en");
  });
});

describe("findMissingEntryPairs", () => {
  test("passes for paired entries", () => {
    expect(
      findMissingEntryPairs([
        { id: "a.en.md", lang: "en", key: "a" },
        { id: "a.es.md", lang: "es", key: "a" },
      ]),
    ).toEqual([]);
  });

  test("fails when a translation is missing", () => {
    const problems = findMissingEntryPairs([{ id: "a.en.md", lang: "en", key: "a" }]);
    expect(problems).toEqual(['Content entry "a" (a.en.md) has no "es" translation.']);
  });
});

describe("messageProblems", () => {
  const file = "chrome.json";

  test("passes for matching keys and placeholders", () => {
    expect(
      messageProblems(file, {
        en: { hi: "Hello {name}" },
        es: { hi: "Hola {name}" },
      }),
    ).toEqual([]);
  });

  test("reports a key missing from one language", () => {
    const problems = messageProblems(file, {
      en: { a: "A", b: "B" },
      es: { a: "A" },
    });
    expect(problems).toEqual([`${file}: key "b" is missing in "es".`]);
  });

  test("reports a renamed or dropped placeholder", () => {
    const problems = messageProblems(file, {
      en: { hi: "Hello {name}" },
      es: { hi: "Hola {nombre}" },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("hi");
    expect(problems[0]).toContain("placeholder");
    expect(messageProblems(file, { en: { hi: "Hello {name}" }, es: { hi: "Hola" } })).toHaveLength(
      1,
    );
  });
});

describe("findDuplicateJsonKeys", () => {
  test("finds a repeated key in one object", () => {
    expect(findDuplicateJsonKeys('{"a":1,"b":2,"a":3}')).toEqual(["a"]);
  });

  test("allows the same key in different objects", () => {
    expect(findDuplicateJsonKeys('{"en":{"a":"x"},"es":{"a":"y"}}')).toEqual([]);
  });

  test("ignores key-like text inside strings", () => {
    expect(findDuplicateJsonKeys(String.raw`{"a":"\"b\":1","b":2}`)).toEqual([]);
  });
});

describe("findUnusedKeys", () => {
  test("flags keys no source mentions", () => {
    expect(findUnusedKeys(["skipLink", "ghost"], ["copy.skipLink"])).toEqual(["ghost"]);
  });
});

describe("lintCopy", () => {
  test("flags leaked TODOs", () => {
    expect(lintCopy("f.json", { en: { a: "TODO translate" } })).toHaveLength(1);
  });

  test("does not mistake the Spanish word todo for a leaked TODO", () => {
    expect(lintCopy("f.json", { es: { a: "Sobre todo TypeScript" } })).toEqual([]);
  });

  test("flags a long title and description", () => {
    const problems = lintCopy("f.json", {
      en: { title: "x".repeat(61), description: "y".repeat(161) },
    });
    expect(problems).toHaveLength(2);
  });

  test("passes clean copy", () => {
    expect(lintCopy("f.json", { en: { title: "andryore.dev" } })).toEqual([]);
  });
});

describe("flattenMessages", () => {
  test("flattens nested objects into dotted keys", () => {
    expect(flattenMessages({ title: "A", theme: { auto: "Auto", dark: "Dark" } })).toEqual({
      title: "A",
      "theme.auto": "Auto",
      "theme.dark": "Dark",
    });
  });

  test("skips non-string leaves", () => {
    expect(flattenMessages({ count: 3, list: ["a"], ok: "x" })).toEqual({
      "list.0": "a",
      ok: "x",
    });
  });
});
