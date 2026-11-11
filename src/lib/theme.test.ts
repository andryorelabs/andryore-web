import { describe, expect, test } from "bun:test";

import {
  getThemeStorage,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  didWriteThemePreference,
  type ThemeStorage,
} from "./theme";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  const storage: ThemeStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { storage, data };
};

const throwingStorage: ThemeStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("parseThemePreference", () => {
  test("keeps the three valid values", () => {
    expect(parseThemePreference("auto")).toBe("auto");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  test("falls back to auto for anything else", () => {
    for (const raw of [null, undefined, "", "Dark", "system", 42, {}]) {
      expect(parseThemePreference(raw)).toBe("auto");
    }
  });
});

describe("getThemeStorage", () => {
  test("returns the storage when reachable", () => {
    const { storage } = memoryStorage();
    expect(getThemeStorage({ localStorage: storage })).toBe(storage);
  });

  test("returns undefined when reading localStorage throws", () => {
    const blocked = {
      get localStorage(): ThemeStorage {
        throw new Error("blocked");
      },
    };
    expect(getThemeStorage(blocked)).toBeUndefined();
  });
});

describe("resolveTheme", () => {
  test("auto follows the system", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  test("light and dark ignore the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("readThemePreference", () => {
  test("defaults to auto with no stored value", () => {
    expect(readThemePreference(memoryStorage().storage)).toBe("auto");
  });

  test("returns a stored valid value", () => {
    const { storage } = memoryStorage({ [THEME_STORAGE_KEY]: "dark" });
    expect(readThemePreference(storage)).toBe("dark");
  });

  test("falls back to auto on an invalid stored value", () => {
    const { storage } = memoryStorage({ [THEME_STORAGE_KEY]: "sepia" });
    expect(readThemePreference(storage)).toBe("auto");
  });

  test("falls back to auto when storage throws or is missing", () => {
    expect(readThemePreference(throwingStorage)).toBe("auto");
    expect(readThemePreference(undefined)).toBe("auto");
  });
});

describe("didWriteThemePreference", () => {
  test("stores light and dark", () => {
    const { storage, data } = memoryStorage();
    expect(didWriteThemePreference(storage, "light")).toBe(true);
    expect(data.get(THEME_STORAGE_KEY)).toBe("light");
  });

  test("clears the key for auto", () => {
    const { storage, data } = memoryStorage({ [THEME_STORAGE_KEY]: "dark" });
    expect(didWriteThemePreference(storage, "auto")).toBe(true);
    expect(data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  test("reports failure instead of throwing", () => {
    expect(didWriteThemePreference(throwingStorage, "dark")).toBe(false);
    expect(didWriteThemePreference(undefined, "dark")).toBe(false);
  });
});
