import type { Graph, Person, WebSite } from "schema-dts";

import { absoluteUrl, homePath, localePath, type Locale } from "../i18n/locales";

const PERSON_ID = absoluteUrl("/#person");
const WEBSITE_ID = absoluteUrl("/#website");

/**
 * Builds the site-wide JSON-LD `@graph`: a `WebSite` and the `Person` behind
 * it, tied together by one shared `@id` so crawlers resolve a single entity.
 * It carries no email and no job title, so the descriptor rule holds.
 * @param locale The language of the page.
 * @param description The visible intro of the site in that language.
 * @returns A JSON string safe to embed in a JSON-LD script element.
 */
export function siteGraphJsonLd(locale: Locale, description: string): string {
  const person: Person = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Andry Orellana",
    alternateName: "AndryOre",
    url: absoluteUrl(localePath(locale, "/about/")),
    description,
    knowsLanguage: ["es", "en"],
  };
  const website: WebSite = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "AndryOre",
    url: absoluteUrl(homePath(locale)),
    inLanguage: locale,
    publisher: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  };
  const graph: Graph = {
    "@context": "https://schema.org",
    "@graph": [website, person],
  };
  return JSON.stringify(graph).replaceAll("<", String.raw`\u003c`);
}
