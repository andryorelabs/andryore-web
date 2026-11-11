/**
 * The three choices of the theme control.
 */
export const THEME_PREFERENCES = ["auto", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

/**
 * The localStorage key shared with the inline pre-paint script.
 */
export const THEME_STORAGE_KEY = "theme";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/**
 * The slice of `Storage` the theme code needs.
 */
export interface ThemeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * Reaches `localStorage` without throwing; merely touching it can throw when
 * site data is blocked.
 * @param win Anything that may expose `localStorage`.
 * @returns The storage, or undefined when it is unavailable.
 */
export function getThemeStorage(
  win: Readonly<{ localStorage?: ThemeStorage }> = globalThis,
): ThemeStorage | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Narrows an untrusted stored value to a preference.
 * @param raw Whatever came out of storage.
 * @returns The preference, or `auto` for anything unrecognised.
 */
export function parseThemePreference(raw: unknown): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === raw) ?? "auto";
}

/**
 * Resolves a preference to the theme that should be painted.
 * @param preference The stored choice.
 * @param isSystemDark Whether the system asks for a dark scheme.
 * @returns `light` or `dark`.
 */
export function resolveTheme(preference: ThemePreference, isSystemDark: boolean): ResolvedTheme {
  if (preference === "auto") return isSystemDark ? "dark" : "light";
  return preference;
}

/**
 * Reads the stored preference without ever throwing; storage can be missing
 * or throw in a private window.
 * @param storage The storage to read, if any.
 * @returns The stored preference, or `auto`.
 */
export function readThemePreference(storage: ThemeStorage | undefined): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

/**
 * Stores a preference without ever throwing. `auto` clears the key, so the
 * default leaves no trace.
 * @param storage The storage to write, if any.
 * @param preference The choice to store.
 * @returns False when the write was not possible.
 */
export function didWriteThemePreference(
  storage: ThemeStorage | undefined,
  preference: ThemePreference,
): boolean {
  if (!storage) return false;
  try {
    if (preference === "auto") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

interface ThemeColorMeta {
  media: string;
  dataset: Readonly<Record<string, string | undefined>>;
}

interface ThemeDocument {
  documentElement: {
    classList: { toggle: (name: string, shouldForce: boolean) => unknown };
  };
  querySelectorAll: (selector: string) => Iterable<ThemeColorMeta>;
}

/**
 * Paints a resolved theme: the `dark` class and the `theme-color` metas.
 * Each meta carries `data-theme-color`; only the one matching the theme keeps
 * a media that matches, so the browser chrome follows the choice, not the
 * system.
 * @param themeDocument The document to update.
 * @param theme The theme to paint.
 */
export function applyResolvedTheme(themeDocument: ThemeDocument, theme: ResolvedTheme): void {
  themeDocument.documentElement.classList.toggle("dark", theme === "dark");
  for (const meta of themeDocument.querySelectorAll('meta[name="theme-color"][data-theme-color]')) {
    meta.media = meta.dataset.themeColor === theme ? "all" : "not all";
  }
}
