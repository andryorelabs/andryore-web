import { absoluteUrl, localePath, type Locale } from "../i18n/locales";

export interface LlmsPage {
  path: string;
  en: { title: string; description: string };
  es: { title: string; description: string };
}

const SECTION_TITLES: Readonly<Record<Locale, string>> = {
  en: "English",
  es: "Español",
};

/**
 * Builds `llms.txt`, the plain index that answer engines read: the site name,
 * a one-line summary and a link list per language.
 * @param summary One sentence describing the site.
 * @param pages Pages with their title and description in both languages.
 * @returns The file body, newline terminated.
 */
export function buildLlmsTxt(summary: string, pages: readonly LlmsPage[]): string {
  const sections = (["en", "es"] as const).map((locale) =>
    [
      `## ${SECTION_TITLES[locale]}`,
      "",
      ...pages.map(
        (page) =>
          `- [${page[locale].title}](${absoluteUrl(localePath(locale, page.path))}): ${page[locale].description}`,
      ),
    ].join("\n"),
  );
  return ["# AndryOre", `> ${summary}`, ...sections].join("\n\n").concat("\n");
}
