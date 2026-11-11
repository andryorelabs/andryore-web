import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import chrome from "../content/chrome.json";
import findMe from "../content/find-me.json";
import home from "../content/home.json";
import liveTiles from "../content/live-tiles.json";
import uses from "../content/uses.json";
import { externalLinkAttributes } from "../lib/external-link";

const COMPONENTS = ["FindMe", "StreamTile", "GithubGridTile", "UsesPage", "UsesBadge"] as const;

const LOCALES = ["en", "es"] as const;

function readComponent(name: string): string {
  return readFileSync(path.join(import.meta.dir, `${name}.astro`), "utf8");
}

function openingAnchors(source: string): string[] {
  return source.match(/<a\b[^>]*>/gs) ?? [];
}

const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

describe("external links wiring", () => {
  for (const name of COMPONENTS) {
    describe(name, () => {
      const source = readComponent(name);

      test("never hardcodes target or rel", () => {
        expect(source).not.toMatch(/\btarget="_blank"/);
        expect(source).not.toMatch(/\brel="/);
        expect(source).not.toContain("externalLinkTokens");
      });

      test("spreads the helper on every external anchor", () => {
        const anchors = openingAnchors(source).filter(
          (anchor) => !anchor.includes("localePath") && !anchor.includes("mailto:"),
        );
        expect(anchors.length).toBeGreaterThan(0);
        for (const anchor of anchors) {
          expect(anchor).toMatch(/\{\.\.\.[^}]+\}/);
        }
      });

      test("announces the new tab", () => {
        expect(source).toMatch(/opensInNewTab|newTabNote|NewTabNote/);
      });
    });
  }

  test("icon-only and profile links put the note inside aria-label", () => {
    expect(readComponent("FindMe")).toContain("labelWithNewTabNote(");
    expect(readComponent("GithubGridTile")).toContain("labelWithNewTabNote(");
  });

  test("text links carry visually hidden note text", () => {
    for (const name of ["StreamTile", "UsesPage", "UsesBadge"]) {
      expect(readComponent(name)).toContain("sr-only");
    }
  });

  for (const locale of LOCALES)
    describe(`content hrefs (${locale})`, () => {
      test("every social link opens in a new tab", () => {
        const { items } = findMe[locale];
        for (const item of items) {
          expect(externalLinkAttributes(item.href)).toEqual(newTab);
        }
      });

      test("the Twitch link opens in a new tab", () => {
        expect(externalLinkAttributes(home[locale].stream.href)).toEqual(newTab);
      });

      test("the GitHub profile link opens in a new tab", () => {
        const tile = liveTiles[locale].github;
        expect(externalLinkAttributes(tile.profileHref)).toEqual(newTab);
      });

      test("every Uses link opens in a new tab", () => {
        const copy = uses[locale];
        const urls = [
          ...copy.setup.map((row) => row.url),
          ...[...copy.tools, ...copy.tech]
            .map((badge) => ("url" in badge ? badge.url : undefined))
            .filter((url): url is string => typeof url === "string"),
          copy.thisSite.sourceUrl,
        ];
        expect(urls.length).toBeGreaterThan(0);
        for (const url of urls) {
          expect(externalLinkAttributes(url)).toEqual(newTab);
        }
      });

      test("the note exists in the chrome copy", () => {
        expect(chrome[locale].opensInNewTab.length).toBeGreaterThan(0);
      });
    });
});
