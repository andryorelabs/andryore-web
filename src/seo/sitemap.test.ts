import { describe, expect, test } from "bun:test";

import { buildSitemap, readLastmod } from "./sitemap";

describe("buildSitemap", () => {
  const xml = buildSitemap(["/", "/about/"], "2026-10-17");

  test("lists each page in both languages", () => {
    for (const loc of [
      "https://andryore.dev/",
      "https://andryore.dev/es/",
      "https://andryore.dev/about/",
      "https://andryore.dev/es/about/",
    ]) {
      expect(xml).toContain(`<loc>${loc}</loc>`);
    }
  });

  test("never lists the 404 page", () => {
    expect(buildSitemap(["/", "/404/"])).not.toContain("/404/");
  });

  test("declares the xhtml namespace", () => {
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  test("gives every url a self-referencing alternate set with x-default", () => {
    const spanishAbout = xml.slice(xml.indexOf("<loc>https://andryore.dev/es/about/"));
    expect(spanishAbout).toContain(
      '<xhtml:link rel="alternate" hreflang="es" href="https://andryore.dev/es/about/"/>',
    );
    expect(spanishAbout).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://andryore.dev/about/"/>',
    );
    expect(spanishAbout).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://andryore.dev/about/"/>',
    );
  });

  test("stamps lastmod when given", () => {
    expect(xml.match(/<lastmod>2026-10-17<\/lastmod>/g)).toHaveLength(4);
  });

  test("omits lastmod without a date", () => {
    expect(buildSitemap(["/"])).not.toContain("lastmod");
  });
});

describe("readLastmod", () => {
  test("accepts an ISO date", () => {
    expect(readLastmod("2026-10-17")).toBe("2026-10-17");
  });

  const buildDate = new Date("2026-10-20T03:00:00Z");

  test("keeps a valid date over the build date", () => {
    expect(readLastmod("2026-10-17", buildDate)).toBe("2026-10-17");
  });

  test("falls back to the build date when unset", () => {
    expect(readLastmod(undefined, buildDate)).toBe("2026-10-20");
  });

  test("falls back to the build date when empty or malformed", () => {
    expect(readLastmod("", buildDate)).toBe("2026-10-20");
    expect(readLastmod("yesterday", buildDate)).toBe("2026-10-20");
  });

  test("defaults the build date to today", () => {
    expect(readLastmod(undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
