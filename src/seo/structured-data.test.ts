import { describe, expect, test } from "bun:test";

import { siteGraphJsonLd } from "./structured-data";

const parse = (locale: "en" | "es") =>
  JSON.parse(siteGraphJsonLd(locale, "Hello")) as {
    "@context": string;
    "@graph": Record<string, unknown>[];
  };

describe("siteGraphJsonLd", () => {
  test("holds a WebSite and a Person in one graph", () => {
    const graph = parse("en")["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "Person"]);
  });

  test("the WebSite points at the Person through one shared @id", () => {
    const [site, person] = parse("en")["@graph"];
    expect(person?.["@id"]).toBe("https://andryore.dev/#person");
    expect(site?.publisher).toEqual({ "@id": person?.["@id"] });
    expect(site?.author).toEqual({ "@id": person?.["@id"] });
  });

  test("localizes url, language and description", () => {
    const [site, person] = parse("es")["@graph"];
    expect(site?.url).toBe("https://andryore.dev/es/");
    expect(site?.inLanguage).toBe("es");
    expect(person?.url).toBe("https://andryore.dev/es/about/");
    expect(person?.description).toBe("Hello");
  });

  test("never states a job title or an email", () => {
    const json = siteGraphJsonLd("en", "x");
    expect(json).not.toContain("jobTitle");
    expect(json).not.toContain("email");
  });

  test("escapes angle brackets", () => {
    expect(siteGraphJsonLd("en", "</script>")).not.toContain("<");
  });
});
