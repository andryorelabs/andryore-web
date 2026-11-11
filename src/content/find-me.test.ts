import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { LOCALES } from "../i18n/locales";
import { ICONS } from "../lib/icons";
import findMe from "./find-me.json";

const glow = (icon: string): RegExp =>
  new RegExp(String.raw`\.find-me-link\[data-icon="${icon}"\] \{\s+--glow: ([^;]+);`);

describe("find me content", () => {
  for (const locale of LOCALES) {
    const copy = findMe[locale];

    test(`${locale} lists eight profiles`, () => {
      expect(copy.items).toHaveLength(8);
    });

    test(`${locale} links are https, unique and use known icons`, () => {
      for (const item of copy.items) {
        expect(item.href).toStartWith("https://");
        expect(Object.keys(ICONS)).toContain(item.icon);
      }
      const hrefs = copy.items.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });

    test(`${locale} has every label filled`, () => {
      for (const [key, value] of Object.entries(copy)) {
        if (typeof value === "string") {
          expect(value.length, key).toBeGreaterThan(0);
        }
      }
    });
  }

  test("both languages carry the canvas subline", () => {
    expect(findMe.en.subline).toBe("Say hi wherever you like.");
    expect(findMe.es.subline).toBe("Salúdame donde prefieras.");
  });

  test("every profile has a glow rule in the global stylesheet", () => {
    const stylesheet = readFileSync("src/styles/global.css", "utf8");
    for (const item of findMe.en.items) {
      expect(stylesheet).toContain(`.find-me-link[data-icon="${item.icon}"]`);
    }
  });

  test("the canvas glow colours and hover lift are in the stylesheet", () => {
    const stylesheet = readFileSync("src/styles/global.css", "utf8");
    expect(stylesheet.match(glow("x"))?.[1]).toBe("#c9d1d9");
    expect(stylesheet.match(glow("youtube"))?.[1]).toBe("#ff0000");
    expect(stylesheet.match(glow("tiktok"))?.[1]).toBe("#fe2c55");
    expect(stylesheet).toContain("translateY(-3px)");
    expect(stylesheet).toContain("0 14px 36px -10px");
  });

  test("both languages list the same profiles in the same order", () => {
    const shape = (locale: (typeof LOCALES)[number]) =>
      findMe[locale].items.map(({ icon, href }) => ({ icon, href }));
    expect(shape("es")).toEqual(shape("en"));
    expect(Object.keys(findMe.es)).toEqual(Object.keys(findMe.en));
  });
});
