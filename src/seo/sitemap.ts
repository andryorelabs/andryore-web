import { absoluteUrl, alternatesFor, DEFAULT_LOCALE, localePath, LOCALES } from "../i18n/locales";

const NOT_FOUND_PATH = "/404/";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolves the sitemap last-modified date. Coolify builds from a shallow clone
 * with no git history and drops build args when build secrets are on, so
 * `SITE_LASTMOD` may be unset or empty; the build date stands in for it.
 * @param raw The raw env value, normally `SITE_LASTMOD`.
 * @param buildDate The fallback moment, normally the current build time.
 * @returns The `YYYY-MM-DD` date: `raw` when valid, else the UTC build date.
 */
export function readLastmod(raw: string | undefined, buildDate: Date = new Date()): string {
  return raw !== undefined && ISO_DATE.test(raw) ? raw : buildDate.toISOString().slice(0, 10);
}

function urlEntry(
  locale: (typeof LOCALES)[number],
  path: string,
  lastmod: string | undefined,
): string {
  const links = [
    ...alternatesFor(path).map(
      (alternate) =>
        `<xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${absoluteUrl(alternate.path)}"/>`,
    ),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(localePath(DEFAULT_LOCALE, path))}"/>`,
  ];
  return [
    "  <url>",
    `    <loc>${absoluteUrl(localePath(locale, path))}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    ...links.map((link) => `    ${link}`),
    "  </url>",
  ].join("\n");
}

/**
 * Builds the language-aware sitemap: one `<url>` per page and language, each
 * carrying the full `hreflang` set including itself.
 * @param paths Locale-neutral page paths such as `/` and `/about/`.
 * @param lastmod Optional `YYYY-MM-DD` date stamped on every url.
 * @returns The sitemap XML.
 */
export function buildSitemap(paths: readonly string[], lastmod?: string): string {
  const entries = paths
    .filter((path) => path !== NOT_FOUND_PATH)
    .flatMap((path) => LOCALES.map((locale) => urlEntry(locale, path, lastmod)));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
