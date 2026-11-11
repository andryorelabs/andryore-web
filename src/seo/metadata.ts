import { absoluteUrl, otherLocale, type Locale } from "../i18n/locales";

export interface MetaTag {
  property: string;
  content: string;
}

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * Title of a page, always carrying the site name exactly once.
 * @param title Title as written in the page content.
 * @param siteName The site name to append when missing.
 * @returns The page title, unchanged when it already names the site.
 */
export function documentTitle(title: string, siteName: string): string {
  return title.includes(siteName) ? title : `${title} | ${siteName}`;
}

/**
 * Path of the static Open Graph image of a language, copied from the brand kit
 * and never fetched remotely.
 * @param locale The language of the page.
 * @returns The public path of the PNG.
 */
export function ogImagePath(locale: Locale): string {
  return `/og/og-${locale}.png`;
}

/**
 * The default Open Graph tags of a page.
 * @param page The page's language, title, description and canonical URL.
 * @param page.locale The language of the page.
 * @param page.title The document title.
 * @param page.description The meta description.
 * @param page.url The absolute canonical URL.
 * @returns The `property`/`content` pairs to render in `<head>`.
 */
export function pageOpenGraphTags(page: {
  locale: Locale;
  title: string;
  description: string;
  url: string;
}): MetaTag[] {
  return [
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "AndryOre" },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: page.url },
    { property: "og:locale", content: page.locale },
    { property: "og:locale:alternate", content: otherLocale(page.locale) },
  ];
}

/**
 * Image and card tags shared by every page, including entries that bring
 * their own `og:*` set.
 * @param locale The language of the page.
 * @param alt Alternative text of the image.
 * @returns The `property`/`content` pairs to render in `<head>`.
 */
export function imageMetaTags(locale: Locale, alt: string): MetaTag[] {
  return [
    { property: "og:image", content: absoluteUrl(ogImagePath(locale)) },
    { property: "og:image:width", content: String(OG_WIDTH) },
    { property: "og:image:height", content: String(OG_HEIGHT) },
    { property: "og:image:alt", content: alt },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:image", content: absoluteUrl(ogImagePath(locale)) },
  ];
}
