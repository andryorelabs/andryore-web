import { describe, expect, test } from "bun:test";

import { documentTitle, imageMetaTags, ogImagePath, pageOpenGraphTags } from "./metadata";

describe("documentTitle", () => {
  test("appends the site name once", () => {
    expect(documentTitle("About", "AndryOre")).toBe("About | AndryOre");
    expect(documentTitle("Snug · AndryOre", "AndryOre")).toBe("Snug · AndryOre");
  });
});

describe("ogImagePath", () => {
  test("is one static image per language", () => {
    expect(ogImagePath("en")).toBe("/og/og-en.png");
    expect(ogImagePath("es")).toBe("/og/og-es.png");
  });
});

describe("pageOpenGraphTags", () => {
  test("describes the page in its own language", () => {
    const tags = pageOpenGraphTags({
      locale: "es",
      title: "T",
      description: "D",
      url: "https://andryore.dev/es/uses/",
    });
    expect(tags).toContainEqual({ property: "og:locale", content: "es" });
    expect(tags).toContainEqual({
      property: "og:locale:alternate",
      content: "en",
    });
    expect(tags).toContainEqual({ property: "og:type", content: "website" });
    expect(tags).toContainEqual({ property: "og:title", content: "T" });
  });
});

describe("imageMetaTags", () => {
  test("points og and twitter at the absolute localized image", () => {
    const tags = imageMetaTags("en", "Alt");
    expect(tags).toContainEqual({
      property: "og:image",
      content: "https://andryore.dev/og/og-en.png",
    });
    expect(tags).toContainEqual({
      property: "og:image:width",
      content: "1200",
    });
    expect(tags).toContainEqual({
      property: "twitter:card",
      content: "summary_large_image",
    });
  });
});
