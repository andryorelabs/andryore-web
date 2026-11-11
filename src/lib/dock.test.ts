import { describe, expect, test } from "bun:test";

import {
  activePageKey,
  activeSectionKey,
  DOCK_PAGES,
  hashSectionKey,
  MAGNIFICATION_MAX_SCALE,
  MAGNIFICATION_RADIUS_PX,
  magnificationScale,
  pageHref,
  type DockPageKey,
} from "./dock";

describe("activeSectionKey", () => {
  test.each<[string[], DockPageKey]>([
    [[], "home"],
    [["products"], "products"],
    [["find-me"], "findMe"],
    [["products", "find-me"], "findMe"],
    [["unknown"], "home"],
  ])("%j is %s", (visible, key) => {
    expect(activeSectionKey(visible)).toBe(key);
  });
});

describe("hashSectionKey", () => {
  test.each<[string, DockPageKey]>([
    ["", "home"],
    ["#products", "products"],
    ["#find-me", "findMe"],
    ["#other", "home"],
  ])("%j is %s", (hash, key) => {
    expect(hashSectionKey(hash)).toBe(key);
  });
});

describe("activePageKey", () => {
  test.each<[string, DockPageKey]>([
    ["/", "home"],
    ["/products/snug/", "products"],
    ["/about/", "about"],
    ["/uses/", "uses"],
  ])("%s is %s", (path, key) => {
    expect(activePageKey(path)).toBe(key);
  });

  test("returns undefined for pages the dock does not list", () => {
    expect(activePageKey("/colophon/")).toBeUndefined();
    expect(activePageKey("/404/")).toBeUndefined();
  });

  test("does not match a longer first segment", () => {
    expect(activePageKey("/aboutus/")).toBeUndefined();
  });
});

describe("pageHref", () => {
  test("keeps English paths at the root", () => {
    expect(pageHref("en", "/about/")).toBe("/about/");
  });

  test("prefixes Spanish paths", () => {
    expect(pageHref("es", "/about/")).toBe("/es/about/");
    expect(pageHref("es", "/#products")).toBe("/es/#products");
  });
});

describe("magnificationScale", () => {
  test("uses the 1.15 peak and 72 px radius of the design token", () => {
    expect(MAGNIFICATION_MAX_SCALE).toBe(1.15);
    expect(MAGNIFICATION_RADIUS_PX).toBe(72);
  });

  test("peaks under the pointer", () => {
    expect(magnificationScale(0)).toBe(MAGNIFICATION_MAX_SCALE);
  });

  test("is 1 at and beyond the radius", () => {
    expect(magnificationScale(MAGNIFICATION_RADIUS_PX)).toBe(1);
    expect(magnificationScale(500)).toBe(1);
  });

  test("falls off monotonically and ignores direction", () => {
    expect(magnificationScale(24)).toBeGreaterThan(magnificationScale(48));
    expect(magnificationScale(-48)).toBe(magnificationScale(48));
    expect(magnificationScale(48)).toBeGreaterThan(1);
  });
});

describe("DOCK_PAGES", () => {
  test("lists the pages in order, ending with Find me", () => {
    expect(DOCK_PAGES.map((page) => page.key)).toEqual([
      "home",
      "about",
      "products",
      "uses",
      "findMe",
    ]);
  });
});
