import { describe, expect, test } from "bun:test";

import { DOCK_PAGES } from "../lib/dock";
import chrome from "./chrome.json";

describe("chrome content", () => {
  for (const locale of ["en", "es"] as const) {
    describe(locale, () => {
      test("names every dock page, including Find me", () => {
        for (const page of DOCK_PAGES) {
          expect(chrome[locale].dock.pages[page.key]).toBeTruthy();
        }
      });

      test("has the opens-in-a-new-tab note", () => {
        expect(chrome[locale].opensInNewTab).toBeTruthy();
      });

      test("has the Sound labels", () => {
        const { sound } = chrome[locale].dock;
        expect(sound.label).toBeTruthy();
        expect(sound.on).not.toBe(sound.off);
      });

      test("matches the canvas text table", () => {
        const copy = chrome[locale];
        const expected = {
          en: ["Auto", "Find me", "Sound off"],
          es: ["Auto", "Encuéntrame", "Sonido apagado"],
        }[locale];
        expect([copy.theme.auto, copy.dock.pages.findMe, copy.dock.sound.off]).toEqual(expected);
      });

      test("labels the FX tile like the canvas", () => {
        const expected = { en: ["FX", "Sound"], es: ["FX", "Sonido"] }[locale];
        expect([chrome[locale].fx.label, chrome[locale].fx.sound]).toEqual(expected);
      });

      test("carries no footer note", () => {
        expect(chrome[locale]).not.toHaveProperty("footerNote");
      });
    });
  }
});
