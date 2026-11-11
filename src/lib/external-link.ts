/**
 * Whether an href leaves the site.
 * @param href A link target.
 * @returns `true` for absolute `http` and `https` URLs.
 */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * The one `rel` value every external link uses, so a dist audit only has to
 * verify it.
 * @param options Link kind.
 * @param options.sponsored Marks a paid or affiliate link.
 * @returns The `rel` attribute value.
 */
export function externalLinkTokens({ sponsored = false }: { sponsored?: boolean } = {}): string {
  return sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";
}

/**
 * `rel` for a link that may or may not be external.
 * @param href A link target.
 * @returns The external `rel`, or `undefined` for internal links.
 */
export function tokensForHref(href: string): string | undefined {
  return isExternalHref(href) ? externalLinkTokens() : undefined;
}

/**
The origin of the Site, used to tell same-origin links from external ones.
 */
const SITE_ORIGIN = "https://andryore.dev";

/**
The `target` and `rel` attributes of an external link.
 */
export interface ExternalLinkAttributes {
  target: "_blank";
  rel: string;
}

/**
 * The one place that decides how an external link opens: a new tab with
 * `noopener noreferrer`. Only http(s) links to another origin qualify.
 * `mailto:`, `tel:`, hash, relative, same-origin and unparsable hrefs get
 * nothing, which includes the language switch.
 * @param href A link target.
 * @param siteOrigin The origin of the Site, overridable for tests.
 * @returns `{ target, rel }` for a cross-origin http(s) href, else `undefined`.
 */
export function externalLinkAttributes(
  href: string,
  siteOrigin: string = SITE_ORIGIN,
): ExternalLinkAttributes | undefined {
  let url: URL;
  try {
    url = new URL(href, siteOrigin);
  } catch {
    return undefined;
  }
  if (url.origin === new URL(siteOrigin).origin) return undefined;
  const tokens = tokensForHref(url.href);
  return tokens === undefined ? undefined : { target: "_blank", rel: tokens };
}

/**
 * An `aria-label` for an icon-only external link: the label followed by the
 * "opens in a new tab" note.
 * @param label The accessible name of the link.
 * @param copy A chrome copy block holding the note.
 * @param copy.opensInNewTab The localized "opens in a new tab" note.
 * @returns The label with the note appended.
 */
export function labelWithNewTabNote(label: string, copy: { opensInNewTab: string }): string {
  return `${label}. ${copy.opensInNewTab}`;
}
