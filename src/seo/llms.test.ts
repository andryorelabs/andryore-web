import { describe, expect, test } from "bun:test";

import { buildLlmsTxt } from "./llms";

const pages = [
  {
    path: "/",
    en: { title: "Home", description: "Intro" },
    es: { title: "Inicio", description: "Intro es" },
  },
  {
    path: "/uses/",
    en: { title: "Uses", description: "Gear" },
    es: { title: "Uso", description: "Equipo" },
  },
];

describe("buildLlmsTxt", () => {
  const body = buildLlmsTxt("Summary line.", pages);

  test("starts with the site name and a summary quote", () => {
    expect(body.startsWith("# AndryOre\n\n> Summary line.\n")).toBe(true);
  });

  test("lists every page with an absolute url in both languages", () => {
    expect(body).toContain("- [Home](https://andryore.dev/): Intro");
    expect(body).toContain("- [Inicio](https://andryore.dev/es/): Intro es");
    expect(body).toContain("- [Uses](https://andryore.dev/uses/): Gear");
    expect(body).toContain("- [Uso](https://andryore.dev/es/uses/): Equipo");
  });

  test("has one section per language and ends with a newline", () => {
    expect(body).toContain("## English");
    expect(body).toContain("## Español");
    expect(body.endsWith("\n")).toBe(true);
  });
});
