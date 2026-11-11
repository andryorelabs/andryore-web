import { describe, expect, test } from "bun:test";

import about from "./about.json";
import uses from "./uses.json";

describe("about copy", () => {
  test("ends the open-to line with a period in both languages", () => {
    expect(about.en.openTo).toBe("Open to contract and full-time work.");
    expect(about.es.openTo).toBe("Abierto a trabajo por contrato y a tiempo completo.");
  });

  test("names the Uses link like the canvas", () => {
    expect(about.en.stackLink).toBe("Everything I use");
    expect(about.es.stackLink).toBe("Todo lo que uso");
  });

  test("names the Home back link on About and Uses", () => {
    expect(about.en.backLink).toBe("Home");
    expect(about.es.backLink).toBe("Inicio");
    expect(uses.en.backLink).toBe("Home");
    expect(uses.es.backLink).toBe("Inicio");
  });

  test("has no dated installs qualifier", () => {
    expect(JSON.stringify(about)).not.toContain("installsAsOf");
  });
});
