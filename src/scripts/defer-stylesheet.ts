/**
Marks an element that carries the URL of a stylesheet to load later.
 */
export const DEFERRED_STYLESHEET_SELECTOR = "[data-defer-stylesheet]";

export interface StylesheetLink {
  rel: string;
  href: string;
}

/**
 * Adds a stylesheet to the document head after the first render, so a sheet
 * that only styles content below the fold never delays the first paint.
 * @param link A new, empty link element.
 * @param href The stylesheet URL.
 * @param parent The element to append the link to, usually the head.
 * @param parent.append Adds the link to the parent.
 */
export function loadStylesheet<Link extends StylesheetLink>(
  link: Link,
  href: string,
  parent: { append(link: NoInfer<Link>): void },
): void {
  link.rel = "stylesheet";
  link.href = href;
  parent.append(link);
}
