import { LOCALES, type Locale } from "../i18n/locales";

/**
Storage key of the remembered CV language.
 */
export const CV_LANGUAGE_STORAGE_KEY = "andryore:cv-language";

/**
The part of a Web Storage the CV preference needs.
 */
export interface CvStorage {
  getItem: (key: string) => string | null | undefined;
  setItem: (key: string, value: string) => void;
}

/**
 * Reads the remembered CV language from the first storage that holds a valid
 * one. Storage can be blocked, so a failing store is skipped.
 * @param stores Stores in priority order, such as local then session.
 * @param fallback Language to use when nothing valid is stored.
 * @returns The remembered language, or the fallback.
 */
export function readCvLanguage(stores: readonly CvStorage[], fallback: Locale): Locale {
  for (const store of stores) {
    try {
      const stored = LOCALES.find((locale) => locale === store.getItem(CV_LANGUAGE_STORAGE_KEY));
      if (stored) return stored;
    } catch {
      continue;
    }
  }
  return fallback;
}

/**
 * Remembers the CV language in the first storage that accepts the write.
 * @param stores Stores in priority order, such as local then session.
 * @param language The language the visitor chose.
 */
export function rememberCvLanguage(stores: readonly CvStorage[], language: Locale): void {
  for (const store of stores) {
    try {
      store.setItem(CV_LANGUAGE_STORAGE_KEY, language);
      return;
    } catch {
      continue;
    }
  }
}

/**
 * Collects the browser stores that are usable, local first and session second.
 * Reading a blocked store can throw, so each one is probed on its own.
 * @param win Anything that exposes the two storages.
 * @param win.localStorage The persistent store, when the browser allows it.
 * @param win.sessionStorage The per-tab store used as the fallback.
 * @returns The stores to pass to the read and remember functions.
 */
export function browserCvStores(win: {
  readonly localStorage?: CvStorage;
  readonly sessionStorage?: CvStorage;
}): CvStorage[] {
  const stores: CvStorage[] = [];
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const store = win[name];
      if (store) stores.push(store);
    } catch {
      continue;
    }
  }
  return stores;
}

/**
What the CV menu reads from and writes to.
 */
export interface CvChoiceStore {
  subscribe: (listener: () => void) => () => void;
  read: (fallback: Locale) => Locale;
  choose: (value: string) => void;
}

/**
 * Creates the store behind the CV menu: it reads the remembered language,
 * persists a new choice and tells subscribers. A choice survives in memory for
 * the page even when every browser store is blocked.
 * @param win Anything that exposes the storages and storage events.
 * @param win.localStorage The persistent store, when the browser allows it.
 * @param win.sessionStorage The per-tab store used as the fallback.
 * @param win.addEventListener Registers a cross-tab `storage` listener.
 * @param win.removeEventListener Unregisters that listener.
 * @returns A store the CV menu subscribes to, reads and writes.
 */
export function createCvChoiceStore(win: {
  readonly localStorage?: CvStorage;
  readonly sessionStorage?: CvStorage;
  addEventListener: (type: "storage", listener: () => void) => void;
  removeEventListener: (type: "storage", listener: () => void) => void;
}): CvChoiceStore {
  const listeners = new Set<() => void>();
  const memory = new Map<string, string>();
  const memoryStore: CvStorage = {
    getItem: (key) => memory.get(key),
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };
  const stores = (): CvStorage[] => [...browserCvStores(win), memoryStore];
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      win.addEventListener("storage", listener);
      return () => {
        listeners.delete(listener);
        win.removeEventListener("storage", listener);
      };
    },
    read: (fallback) => readCvLanguage(stores(), fallback),
    choose: (value) => {
      const language = LOCALES.find((locale) => locale === value);
      if (!language) return;
      rememberCvLanguage(stores(), language);
      for (const listener of listeners) listener();
    },
  };
}
