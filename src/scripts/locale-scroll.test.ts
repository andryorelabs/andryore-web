import { describe, expect, test } from "bun:test";

import {
  LOCALE_SCROLL_KEY,
  parseLocaleScroll,
  pickAnchor,
  didRestoreLocaleScroll,
  saveLocaleScroll,
} from "./locale-scroll";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function fakeDocument(rects: Record<string, { top: number; bottom: number }>) {
  return {
    querySelector: (selector: string) => {
      const rect = rects[selector];
      return rect ? { getBoundingClientRect: () => rect } : null;
    },
  };
}

function fakeWindow(scrollY: number) {
  const calls: { top: number; behavior: string }[] = [];
  return {
    scrollY,
    calls,
    scrollTo: (options: { top: number; behavior: "instant" }) => void calls.push(options),
  };
}

describe("pickAnchor", () => {
  test("picks the topmost section still on screen", () => {
    expect(
      pickAnchor([
        { selector: "#products", top: -900, bottom: -100 },
        { selector: "#find-me", top: -40, bottom: 600 },
      ]),
    ).toEqual({ selector: "#find-me", offset: 40 });
  });

  test("returns undefined when nothing is visible", () => {
    expect(pickAnchor([])).toBeUndefined();
    expect(pickAnchor([{ selector: "#products", top: -500, bottom: -1 }])).toBeUndefined();
  });
});

describe("parseLocaleScroll", () => {
  test("rejects missing and malformed values", () => {
    expect(parseLocaleScroll(null)).toBeUndefined();
    expect(parseLocaleScroll("nope")).toBeUndefined();
    expect(parseLocaleScroll("null")).toBeUndefined();
    expect(parseLocaleScroll('{"to":"/","y":"1"}')).toBeUndefined();
  });

  test("drops an anchor outside the allowed list", () => {
    expect(parseLocaleScroll('{"to":"/","y":5,"anchor":{"selector":"body","offset":1}}')).toEqual({
      to: "/",
      y: 5,
    });
  });

  test("keeps a valid anchor", () => {
    expect(
      parseLocaleScroll('{"to":"/es/","y":5,"anchor":{"selector":"#products","offset":12}}'),
    ).toEqual({
      to: "/es/",
      y: 5,
      anchor: { selector: "#products", offset: 12 },
    });
  });
});

describe("save and restore", () => {
  test("restores to the anchor plus offset on the target page", () => {
    const storage = fakeStorage();
    saveLocaleScroll(
      storage,
      fakeWindow(1000),
      fakeDocument({ "#products": { top: -30, bottom: 500 } }),
      "/es/",
    );
    const win = fakeWindow(0);
    const restored = didRestoreLocaleScroll(
      storage,
      win,
      fakeDocument({ "#products": { top: 1200, bottom: 1900 } }),
      "/es/",
    );
    expect(restored).toBe(true);
    expect(win.calls).toEqual([{ top: 1230, behavior: "instant" }]);
    expect(storage.data.has(LOCALE_SCROLL_KEY)).toBe(false);
  });

  test("falls back to the saved scroll position without an anchor", () => {
    const storage = fakeStorage();
    saveLocaleScroll(storage, fakeWindow(640), fakeDocument({}), "/es/");
    const win = fakeWindow(0);
    didRestoreLocaleScroll(storage, win, fakeDocument({}), "/es/");
    expect(win.calls).toEqual([{ top: 640, behavior: "instant" }]);
  });

  test("consumes the entry without scrolling on another page", () => {
    const storage = fakeStorage();
    saveLocaleScroll(storage, fakeWindow(640), fakeDocument({}), "/es/");
    const win = fakeWindow(0);
    expect(didRestoreLocaleScroll(storage, win, fakeDocument({}), "/")).toBe(false);
    expect(win.calls).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  test("does nothing when storage throws", () => {
    const broken = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("blocked");
      },
      removeItem: (): void => undefined,
    };
    expect(() => {
      saveLocaleScroll(broken, fakeWindow(1), fakeDocument({}), "/");
    }).not.toThrow();
    expect(didRestoreLocaleScroll(broken, fakeWindow(0), fakeDocument({}), "/")).toBe(false);
  });
});
