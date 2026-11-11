/**
The Umami Cloud tracker script (ADR 0014).
 */
export const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";

/**
The Umami Cloud origin allowed in `script-src`.
 */
export const UMAMI_SCRIPT_ORIGIN = "https://cloud.umami.is";

/**
The Umami Cloud origin allowed in `connect-src`.
 */
export const UMAMI_GATEWAY_ORIGIN = "https://gateway.umami.is";

/**
The public Umami website ID; it identifies the site and is not a secret.
 */
export const UMAMI_WEBSITE_ID = "fed60770-afb1-4d7f-8e7b-684698a02450";

/**
The only hostname the tracker counts, so previews and local builds are not.
 */
export const ANALYTICS_DOMAIN = "andryore.dev";

/**
The kebab-case names of the attribute-only events.
 */
export const ANALYTICS_EVENTS = {
  dockNavigate: "dock-navigate",
  languageSwitch: "language-switch",
  themeSwitch: "theme-switch",
  productOpen: "product-open",
  cvDownload: "cv-download",
} as const;

/**
 * Builds the `data-umami-event*` attributes of one event.
 * @param name The event name.
 * @param properties Locale-independent property values, keyed by property name.
 * @returns The attributes to spread onto the element.
 */
export function analyticsAttributes(
  name: string,
  properties: Record<string, string> = {},
): Record<string, string> {
  const attributes: Record<string, string> = { "data-umami-event": name };
  for (const [key, value] of Object.entries(properties)) {
    attributes[`data-umami-event-${key}`] = value;
  }
  return attributes;
}
