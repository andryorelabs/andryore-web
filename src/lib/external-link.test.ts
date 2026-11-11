import { describe, expect, test } from "bun:test";

import {
  externalLinkAttributes,
  externalLinkTokens,
  isExternalHref,
  labelWithNewTabNote,
  tokensForHref,
} from "./external-link";

describe("external links", () => {
  test("detects absolute http and https targets only", () => {
    expect(isExternalHref("https://github.com/x")).toBe(true);
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("/about/")).toBe(false);
    expect(isExternalHref("mailto:hello@andryore.dev")).toBe(false);
  });

  test("always carries noopener and noreferrer", () => {
    expect(externalLinkTokens()).toBe("noopener noreferrer");
    expect(externalLinkTokens({ sponsored: true })).toBe("sponsored noopener noreferrer");
  });

  test("internal links get no rel", () => {
    expect(tokensForHref("/uses/")).toBeUndefined();
    expect(tokensForHref("https://twitch.tv/x")).toBe("noopener noreferrer");
  });

  describe("externalLinkAttributes", () => {
    const newTab = { target: "_blank", rel: "noopener noreferrer" } as const;

    test("opens https and http external links in a new tab", () => {
      expect(externalLinkAttributes("https://github.com/x")).toEqual(newTab);
      expect(externalLinkAttributes("HTTP://example.com")).toEqual(newTab);
    });

    test("treats protocol-relative links to another host as external", () => {
      expect(externalLinkAttributes("//example.com/a")).toEqual(newTab);
    });

    test("returns nothing for everything that stays in the tab", () => {
      for (const href of [
        "mailto:hello@andryore.dev",
        "tel:+123456789",
        "#top",
        "/es/",
        "about/",
        "https://andryore.dev/uses/",
        "//andryore.dev/uses/",
        "javascript:void(0)",
        "http://",
        "",
      ]) {
        expect(externalLinkAttributes(href)).toBeUndefined();
      }
    });

    test("honours a custom site origin", () => {
      expect(externalLinkAttributes("https://a.test/x", "https://a.test")).toBeUndefined();
      expect(externalLinkAttributes("https://andryore.dev", "https://a.test")).toEqual(newTab);
    });
  });

  test("labelWithNewTabNote appends the note to an aria-label", () => {
    expect(labelWithNewTabNote("GitHub", { opensInNewTab: "Opens in a new tab" })).toBe(
      "GitHub. Opens in a new tab",
    );
  });
});
