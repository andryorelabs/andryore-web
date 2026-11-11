import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import chrome from "../content/chrome.json";
import { externalLinkAttributes } from "../lib/external-link";

const PRODUCTS_DIRECTORY = path.resolve(import.meta.dir, "..", "content", "products");
const source = readFileSync(path.join(import.meta.dir, "ProductPage.astro"), {
  encoding: "utf8",
});

const anchors = source.match(/<a\b[\s\S]*?<\/a>/g) ?? [];
const backLink = anchors.find((anchor) => anchor.includes("data-product-back"));
const externalAnchors = anchors.filter((anchor) => !anchor.includes("data-product-back"));

describe("product page external links", () => {
  test("finds the back link and the four external link sites", () => {
    expect(backLink).toBeDefined();
    expect(externalAnchors).toHaveLength(4);
  });

  test("the back link stays in the same tab", () => {
    expect(backLink).not.toContain("externalLinkAttributes");
    expect(backLink).not.toContain("target");
    expect(backLink).not.toContain("rel=");
  });

  test("every external anchor gets target and rel from the helper", () => {
    for (const anchor of externalAnchors) {
      expect(anchor).toMatch(/\{\.\.\.externalLinkAttributes\(/);
      expect(anchor).not.toContain("externalLinkTokens");
      expect(anchor).not.toMatch(/\btarget=/);
      expect(anchor).not.toMatch(/\brel=/);
    }
  });

  test("every external anchor announces the new tab", () => {
    for (const anchor of externalAnchors) {
      expect(anchor).toContain("copy.opensInNewTab");
    }
  });

  for (const locale of ["en", "es"] as const) {
    test(`${locale} chrome copy has the new tab note`, () => {
      expect(chrome[locale].opensInNewTab.length).toBeGreaterThan(0);
    });
  }

  for (const file of readdirSync(PRODUCTS_DIRECTORY)) {
    test(`${file} links are all cross-origin and open in a new tab`, () => {
      const text = readFileSync(path.join(PRODUCTS_DIRECTORY, file), {
        encoding: "utf8",
      });
      const frontmatter = text.split(/^---$/m, 2)[1] ?? "";
      const hrefs = frontmatter.match(/https?:\/\/[^\s'"]+/g) ?? [];
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(externalLinkAttributes(href)).toEqual({
          target: "_blank",
          rel: "noopener noreferrer",
        });
      }
    });
  }
});
