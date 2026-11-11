import chrome from "../src/content/chrome.json" with { type: "json" };
import home from "../src/content/home.json" with { type: "json" };

export type Language = "en" | "es";

/**
 * Reads the Site chrome copy of a language, so specs locate elements by the
 * same message files the pages render from.
 * @param language The page language.
 * @returns The chrome copy.
 */
export function chromeMessages(language: Language) {
  return chrome[language];
}

/**
 * Reads the stream tile copy of a language.
 * @param language The page language.
 * @returns The stream tile copy.
 */
export function streamMessages(language: Language) {
  return home[language].stream;
}

/**
 * Tells the language of a route from its path.
 * @param route A route such as `/es/about/`.
 * @returns `es` under `/es/`, `en` otherwise.
 */
export function languageOf(route: string): Language {
  return route.startsWith("/es/") ? "es" : "en";
}
