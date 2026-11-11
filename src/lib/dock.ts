import { localePath, type Locale } from "../i18n/locales";

/**
The pages the dock links to, in display order.
 */
export const DOCK_PAGES = [
  { key: "home", path: "/", section: "" },
  { key: "about", path: "/about/", section: "about" },
  { key: "products", path: "/#products", section: "products" },
  { key: "uses", path: "/uses/", section: "uses" },
  { key: "findMe", path: "/#find-me", section: "find-me" },
] as const;

export type DockPageKey = (typeof DOCK_PAGES)[number]["key"];

/**
Largest scale a dock item reaches under the pointer.
 */
export const MAGNIFICATION_MAX_SCALE = 1.15;

/**
Distance from the pointer, in pixels, past which an item is not scaled.
 */
export const MAGNIFICATION_RADIUS_PX = 72;

/**
 * Which dock page a locale-neutral path belongs to.
 * @param path Path without any language prefix, such as `/products/snug/`.
 * @returns The page key, or undefined for pages the dock does not list.
 */
export function activePageKey(path: string): DockPageKey | undefined {
  const section = path.split("/").find(Boolean) ?? "";
  return DOCK_PAGES.find((page) => page.section === section)?.key;
}

/**
Ids of the home page sections the dock follows, in page order.
 */
export const HOME_SECTION_IDS: readonly string[] = DOCK_PAGES.filter((page) =>
  page.path.startsWith("/#"),
).map((page) => page.section);

/**
 * Which dock page the home scroll position belongs to.
 * @param visibleSections Ids of the home sections currently in view.
 * @returns The page of the last visible section in page order, or `home` when
 *   none is in view.
 */
export function activeSectionKey(visibleSections: readonly string[]): DockPageKey {
  const visible = DOCK_PAGES.filter(
    (page) => HOME_SECTION_IDS.includes(page.section) && visibleSections.includes(page.section),
  );
  return visible.at(-1)?.key ?? "home";
}

/**
 * Dock page of a location hash on the home page.
 * @param hash A location hash such as `#products`.
 * @returns The page of that section, or `home` for any other hash.
 */
export function hashSectionKey(hash: string): DockPageKey {
  return activeSectionKey([hash.replace(/^#/, "")]);
}

/**
 * Link target of a dock page in a language.
 * @param locale The language to link to.
 * @param path Locale-neutral page path.
 * @returns The path with the language prefix applied.
 */
export function pageHref(locale: Locale, path: string): string {
  return localePath(locale, path);
}

/**
 * Scale of a dock item for a pointer distance: the maximum under the pointer,
 * easing linearly to 1 at the radius.
 * @param distance Horizontal distance in pixels from the item centre.
 * @returns A scale between 1 and the maximum.
 */
export function magnificationScale(distance: number): number {
  const ratio = Math.min(Math.abs(distance) / MAGNIFICATION_RADIUS_PX, 1);
  return 1 + (MAGNIFICATION_MAX_SCALE - 1) * (1 - ratio);
}
