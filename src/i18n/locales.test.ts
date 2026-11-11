import { describe, expect, test } from "bun:test";

import {
  absoluteUrl,
  alternatesFor,
  homePath,
  localePath,
  LOCALES,
  otherLocale,
  splitLocalePath,
} from "./locales";

describe("homePath", () => {
  test("serves English at the root", () => {
    expect(homePath("en")).toBe("/");
  });

  test("serves Spanish under /es/", () => {
    expect(homePath("es")).toBe("/es/");
  });

  test("covers every locale", () => {
    expect(LOCALES.map((locale) => homePath(locale))).toEqual(["/", "/es/"]);
  });
});

describe("localePath", () => {
  test("keeps English paths unprefixed", () => {
    expect(localePath("en", "/about/")).toBe("/about/");
  });

  test("prefixes Spanish paths with /es", () => {
    expect(localePath("es", "/about/")).toBe("/es/about/");
    expect(localePath("es", "/")).toBe("/es/");
  });
});

describe("splitLocalePath", () => {
  test("reads English paths", () => {
    expect(splitLocalePath("/about/")).toEqual({
      locale: "en",
      path: "/about/",
    });
  });

  test("reads Spanish paths and strips the prefix", () => {
    expect(splitLocalePath("/es/about/")).toEqual({
      locale: "es",
      path: "/about/",
    });
    expect(splitLocalePath("/es/")).toEqual({ locale: "es", path: "/" });
    expect(splitLocalePath("/es")).toEqual({ locale: "es", path: "/" });
  });

  test("does not mistake a path that merely starts with es", () => {
    expect(splitLocalePath("/estudio/")).toEqual({
      locale: "en",
      path: "/estudio/",
    });
  });
});

describe("otherLocale", () => {
  test("swaps the language", () => {
    expect(otherLocale("en")).toBe("es");
    expect(otherLocale("es")).toBe("en");
  });
});

describe("alternatesFor", () => {
  test("lists both languages with hreflang and paths", () => {
    expect(alternatesFor("/about/")).toEqual([
      { locale: "en", hreflang: "en", path: "/about/" },
      { locale: "es", hreflang: "es", path: "/es/about/" },
    ]);
  });
});

describe("absoluteUrl", () => {
  test("anchors a path on the production origin", () => {
    expect(absoluteUrl("/es/")).toBe("https://andryore.dev/es/");
  });
});
