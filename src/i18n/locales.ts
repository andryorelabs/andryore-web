/**
 * Site languages: English at `/`, Spanish at `/es/`.
 */
export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * The language served at the root and used as `x-default`.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Production origin that canonical, hreflang and sitemap URLs hang from.
 */
const SITE_ORIGIN = "https://andryore.dev";

/**
 * The `hreflang` code of each language.
 */
const HREFLANG: Readonly<Record<Locale, string>> = {
  en: "en",
  es: "es",
};

export interface LocaleAlternate {
  locale: Locale;
  hreflang: string;
  path: string;
}

/**
 * Path of a page in a language.
 * @param locale The language to link to.
 * @param path Locale-neutral page path with leading and trailing slash.
 * @returns The path unchanged for English, prefixed with `/es` for Spanish.
 */
export function localePath(locale: Locale, path: string): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/**
 * Home path of a locale, with the trailing slash the site enforces.
 * @param locale The language to link to.
 * @returns `/` for English, `/es/` for Spanish.
 */
export function homePath(locale: Locale): string {
  return localePath(locale, "/");
}

/**
 * Splits a request path into its language and locale-neutral page path.
 * @param pathname A URL pathname such as `/es/about/`.
 * @returns The language and the path without any language prefix.
 */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix) return { locale, path: "/" };
    if (pathname.startsWith(`${prefix}/`)) {
      return { locale, path: pathname.slice(prefix.length) };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * The language a switch should point to.
 * @param locale The current language.
 * @returns The other language.
 */
export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "es" : "en";
}

/**
 * Every language version of a page, for `hreflang` and the sitemap.
 * @param path Locale-neutral page path.
 * @returns One alternate per language, the page itself included.
 */
export function alternatesFor(path: string): LocaleAlternate[] {
  return LOCALES.map((locale) => ({
    locale,
    hreflang: HREFLANG[locale],
    path: localePath(locale, path),
  }));
}

/**
 * Absolute URL of a site path.
 * @param path A path starting with `/`.
 * @returns The path on the production origin.
 */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}
