import { describe, expect, test } from "bun:test";

import { loadStylesheet, type StylesheetLink } from "./defer-stylesheet";

describe("loadStylesheet", () => {
  test("appends a stylesheet link for the URL to the parent", () => {
    const appended: StylesheetLink[] = [];
    const link: StylesheetLink = { rel: "", href: "" };
    loadStylesheet(link, "/_astro/stack-scene.css", {
      append: (added) => {
        appended.push(added);
      },
    });
    expect(appended).toEqual([{ rel: "stylesheet", href: "/_astro/stack-scene.css" }]);
  });
});
