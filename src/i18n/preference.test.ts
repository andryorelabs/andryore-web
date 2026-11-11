import { describe, expect, test } from "bun:test";

import { readLocalePreference, rememberLocale } from "./preference";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
}

const brokenStorage = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
};

describe("locale preference", () => {
  test("remembers the chosen language", () => {
    const storage = memoryStorage();
    rememberLocale(storage, "es");
    expect(readLocalePreference(storage)).toBe("es");
  });

  test("reads nothing when no preference was stored", () => {
    expect(readLocalePreference(memoryStorage())).toBeUndefined();
  });

  test("ignores an unknown stored value", () => {
    expect(readLocalePreference(memoryStorage({ "andryore:locale": "fr" }))).toBeUndefined();
  });

  test("survives storage that throws", () => {
    expect(() => {
      rememberLocale(brokenStorage, "en");
    }).not.toThrow();
    expect(readLocalePreference(brokenStorage)).toBeUndefined();
  });
});
