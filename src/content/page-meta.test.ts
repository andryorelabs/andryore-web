import { describe, expect, test } from "bun:test";

import about from "./about.json";
import home from "./home.json";
import notFound from "./not-found.json";
import uses from "./uses.json";

type Locale = "en" | "es";

function pageMeta(locale: Locale): { title: string; description: string }[] {
  return [
    home[locale].meta,
    {
      title: about[locale].pageTitle,
      description: about[locale].pageDescription,
    },
    uses[locale].meta,
    notFound[locale].meta,
  ];
}

describe("page metadata", () => {
  for (const locale of ["en", "es"] as const) {
    test(`every ${locale} page has a unique title and description`, () => {
      const meta = pageMeta(locale);
      const titles = meta.map((entry) => entry.title);
      const descriptions = meta.map((entry) => entry.description);
      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(descriptions).size).toBe(descriptions.length);
      for (const entry of meta) {
        expect(entry.title.length).toBeGreaterThan(0);
        expect(entry.description.length).toBeGreaterThan(0);
      }
    });
  }
});

describe("404 copy", () => {
  test("carries the canvas copy in both languages", () => {
    expect(notFound.en.heading).toBe("This page wandered off.");
    expect(notFound.en.message).toBe("I tested it. It is not here.");
    expect(notFound.en.home).toBe("Go to the home page");
    expect(notFound.en.products).toBe("See what I build");
    for (const locale of ["en", "es"] as const) {
      expect(notFound[locale].code).toBe("404");
    }
  });
});
