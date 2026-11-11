import { describe, expect, test } from "bun:test";

import {
  browserCvStores,
  createCvChoiceStore,
  CV_LANGUAGE_STORAGE_KEY,
  readCvLanguage,
  rememberCvLanguage,
  type CvStorage,
} from "./cv-preference";

const memoryStorage = (): CvStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key),
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const blockedStorage: CvStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("CV language preference", () => {
  test("defaults to the page language when nothing is remembered", () => {
    expect(readCvLanguage([memoryStorage()], "es")).toBe("es");
    expect(readCvLanguage([memoryStorage()], "en")).toBe("en");
  });

  test("remembers the choice in the first storage that accepts it", () => {
    const local = memoryStorage();
    rememberCvLanguage([local, memoryStorage()], "es");
    expect(local.values.get(CV_LANGUAGE_STORAGE_KEY)).toBe("es");
    expect(readCvLanguage([local], "en")).toBe("es");
  });

  test("falls back to the session store when local storage is blocked", () => {
    const session = memoryStorage();
    rememberCvLanguage([blockedStorage, session], "es");
    expect(readCvLanguage([blockedStorage, session], "en")).toBe("es");
  });

  test("ignores unknown stored values", () => {
    const local = memoryStorage();
    local.setItem(CV_LANGUAGE_STORAGE_KEY, "fr");
    expect(readCvLanguage([local], "en")).toBe("en");
  });

  test("never throws when every store is blocked", () => {
    rememberCvLanguage([blockedStorage], "es");
    expect(readCvLanguage([blockedStorage], "en")).toBe("en");
  });

  test("collects the stores a window exposes and skips blocked ones", () => {
    const session = memoryStorage();
    const win = {
      get localStorage(): CvStorage {
        throw new Error("blocked");
      },
      sessionStorage: session,
    };
    expect(browserCvStores(win)).toEqual([session]);
  });
});

const windowWith = (local: CvStorage, session: CvStorage) => {
  const listened: (() => void)[] = [];
  return {
    listened,
    localStorage: local,
    sessionStorage: session,
    addEventListener: (_type: "storage", listener: () => void) => {
      listened.push(listener);
    },
    removeEventListener: (_type: "storage", listener: () => void) => {
      listened.splice(listened.indexOf(listener), 1);
    },
  };
};

describe("createCvChoiceStore", () => {
  test("remembers a choice across reloads of the store", () => {
    const local = memoryStorage();
    const first = createCvChoiceStore(windowWith(local, memoryStorage()));
    expect(first.read("en")).toBe("en");
    first.choose("es");
    const reloaded = createCvChoiceStore(windowWith(local, memoryStorage()));
    expect(reloaded.read("en")).toBe("es");
  });

  test("keeps the choice for the page when every browser store is blocked", () => {
    const store = createCvChoiceStore(windowWith(blockedStorage, blockedStorage));
    store.choose("es");
    expect(store.read("en")).toBe("es");
  });

  test("notifies subscribers once per choice and stops after unsubscribe", () => {
    const win = windowWith(memoryStorage(), memoryStorage());
    const store = createCvChoiceStore(win);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.choose("es");
    expect(calls).toBe(1);
    unsubscribe();
    store.choose("en");
    expect(calls).toBe(1);
    expect(win.listened).toHaveLength(0);
  });

  test("ignores a language it does not know", () => {
    const store = createCvChoiceStore(windowWith(memoryStorage(), memoryStorage()));
    store.choose("fr");
    expect(store.read("en")).toBe("en");
  });
});
