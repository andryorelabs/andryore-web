import { LOCALES, type Locale } from "./locales";

const STORAGE_KEY = "andryore:locale";

export interface PreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
 * Remembers the language the reader chose. It is only a stored preference: the
 * site never redirects on it (ADR 0002). Storage can be blocked, so failures
 * are ignored.
 * @param storage A `localStorage`-like store.
 * @param locale The language the reader switched to.
 */
export function rememberLocale(storage: PreferenceStorage, locale: Locale): void {
  try {
    storage.setItem(STORAGE_KEY, locale);
  } catch {
    return;
  }
}

/**
 * Reads the remembered language.
 * @param storage A `localStorage`-like store.
 * @returns The stored language, or `undefined` when absent, unknown or
 *   unreadable.
 */
export function readLocalePreference(storage: PreferenceStorage): Locale | undefined {
  try {
    const value = storage.getItem(STORAGE_KEY);
    return LOCALES.find((locale) => locale === value);
  } catch {
    return undefined;
  }
}
