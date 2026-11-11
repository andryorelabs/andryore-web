import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { LOCALES, type Locale } from "../i18n/locales";
import { GLYPH_BODIES } from "../lib/glyphs";
import { ICONS } from "../lib/icons";
import { ALT_BADGES, BADGE_COLORS, SETUP_GLYPHS } from "../lib/uses";
import chrome from "./chrome.json";
import uses from "./uses.json";

const SOURCE_ROOT = path.resolve(import.meta.dir, "..");

const pageSource = (locale: Locale): string =>
  readFileSync(
    path.join(SOURCE_ROOT, "pages", locale === "en" ? "uses.astro" : "es/uses.astro"),
    "utf8",
  );

const allUrls = (locale: Locale): string[] => {
  const copy = uses[locale];
  const urls = [
    ...copy.tools.map((badge) => ("url" in badge ? badge.url : "")),
    ...copy.tech.map((badge) => ("url" in badge ? badge.url : "")),
    ...copy.setup.map((row) => ("url" in row ? row.url : "")),
    copy.thisSite.sourceUrl,
  ];
  return urls.filter((url) => url !== "");
};

const shape = (locale: Locale): unknown[] =>
  [...uses[locale].tools, ...uses[locale].tech, ...uses[locale].setup].map((entry) => [
    "name" in entry ? entry.name : null,
    "icon" in entry ? entry.icon : entry.glyph,
    "url" in entry ? entry.url : null,
  ]);

describe("uses content", () => {
  for (const locale of LOCALES) {
    const copy = uses[locale];

    test(`${locale} has 13 tools and 25 tech badges`, () => {
      expect(copy.tools).toHaveLength(15);
      expect(copy.tech).toHaveLength(25);
    });

    test(`${locale} carries no sample flag or affiliate disclosure`, () => {
      const text = JSON.stringify(copy).toLowerCase();
      expect(text).not.toContain("sample");
      expect(text).not.toContain("affiliate");
      expect(text).not.toContain('"sponsored"');
    });

    test(`${locale} urls are plain: no short link, tag or query string`, () => {
      for (const url of allUrls(locale)) {
        expect(url.startsWith("https://")).toBe(true);
        expect(url).not.toContain("amzn.to");
        expect(url).not.toContain("tag=");
        if (new URL(url).hostname === "www.amazon.com") {
          expect(url).toMatch(/^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}$/);
        }
      }
    });

    test(`${locale} every badge icon resolves in the icon lookup`, () => {
      const badges = [...copy.tools, ...copy.tech];
      for (const badge of badges) {
        expect(Object.hasOwn(ICONS, badge.icon)).toBe(true);
        expect(Object.hasOwn(BADGE_COLORS, badge.icon) || ALT_BADGES.has(badge.icon as never)).toBe(
          true,
        );
      }
    });

    test(`${locale} setup rows use the Lucide glyphs in order`, () => {
      expect(copy.setup.map((row) => row.glyph)).toEqual([...SETUP_GLYPHS]);
      for (const row of copy.setup) {
        expect(Object.hasOwn(GLYPH_BODIES, row.glyph)).toBe(true);
      }
    });

    test(`${locale} meta text stays within the limits`, () => {
      expect(copy.meta.title.length).toBeLessThanOrEqual(60);
      expect(copy.meta.description.length).toBeLessThanOrEqual(160);
    });

    test(`${locale} footer carries no colophon link`, () => {
      expect("colophonLabel" in chrome[locale]).toBe(false);
    });

    test(`${locale} uses route renders its page for the locale`, () => {
      const source = pageSource(locale);
      expect(source).toContain("UsesPage.astro");
      expect(source).toContain(`locale="${locale}"`);
    });
  }

  test("both languages list the same badges, icons and links", () => {
    expect(shape("es")).toEqual(shape("en"));
  });

  test("every setup row links out", () => {
    for (const locale of LOCALES) {
      const { setup } = uses[locale];
      for (const row of setup) {
        expect("url" in row).toBe(true);
      }
    }
  });

  test("the closing line and this-site copy exist in both languages", () => {
    for (const locale of LOCALES) {
      expect(uses[locale].techClosing).not.toBe("");
      expect(uses[locale].thisSite.type.readout).toBe("60 px · 16 px");
      expect(uses[locale].thisSite.type.specimens.map((s) => s.font)).toEqual([
        "Space Grotesk",
        "JetBrains Mono",
      ]);
    }
  });
});

describe("uses canvas copy", () => {
  test("the hero subtitle follows the Uses v4 artboard", () => {
    expect(uses.en.intro).toBe(
      "What I build and stream with: tools on my machine, tech in my projects, my setup and how this site is made.",
    );
    expect(uses.es.intro).toContain("cómo está hecho este sitio");
  });

  test("the This site subline exists in both languages", () => {
    expect(uses.en.thisSite.intro).toBe("How andryore.dev is made.");
    expect(uses.es.thisSite.intro).toBe("Cómo está hecho andryore.dev.");
  });

  test("setup rows pair a category with a product name", () => {
    expect(uses.en.setup.map((row) => row.role)).toEqual([
      "Laptop",
      "Microphone",
      "Camera",
      "Mouse",
      "Keyboard",
      "USB-C hub",
      "Earbuds",
    ]);
  });

  test("the tools run in canvas order and Hono closes the tech list", () => {
    expect(uses.en.tools.map((badge) => badge.name)).toEqual([
      "Claude Code",
      "Orca",
      "Nushell",
      "Starship",
      "Git",
      "GitHub CLI",
      "Linear",
      "Docker",
      "Coolify",
      "Tailscale",
      "Cloudflare Tunnel",
      "chezmoi + age",
      "Bitwarden CLI",
      "mise",
      "GitHub Actions",
    ]);
    expect(uses.en.tech.at(-1)?.name).toBe("Hono");
    expect(uses.en.tech[2]?.name).toBe("Astro + Starlight");
  });

  test("the This site tiles carry the canvas subtitles", () => {
    expect(uses.en.thisSite.hosting.body).toBe("Docker image with nginx, deployed through Coolify");
    expect(uses.es.thisSite.hosting.title).toBe("Hosting");
    expect(uses.es.thisSite.source.body).toBe("Público en GitHub");
    expect(uses.en.thisSite.sourceLinkLabel).toBe("View the source on GitHub");
    expect(uses.es.thisSite.sourceLinkLabel).toBe("Ver el código en GitHub");
    expect(uses.es.setupHeading).toBe("Setup");
  });

  test("privacy copy stays in a card of its own", () => {
    const source = readFileSync(path.join(SOURCE_ROOT, "components/UsesPage.astro"), "utf8");
    expect(source).toContain('aria-labelledby="uses-privacy"');
    for (const locale of LOCALES) expect(uses[locale].thisSite.privacyBody).toContain("Umami");
  });
});

describe("colophon removal", () => {
  test("the colophon pages, component and content are gone", () => {
    for (const file of [
      "pages/colophon.astro",
      "pages/es/colophon.astro",
      "components/ColophonPage.astro",
      "content/colophon.json",
    ]) {
      expect(existsSync(path.join(SOURCE_ROOT, file))).toBe(false);
    }
  });

  test("this site facts match the build", () => {
    const text = JSON.stringify(uses.en.thisSite);
    const manifest = readFileSync(path.resolve(SOURCE_ROOT, "..", "package.json"), "utf8");
    expect(text).toContain("Space Grotesk");
    expect(text).toContain("JetBrains Mono");
    expect(manifest).toContain("@fontsource-variable/space-grotesk");
    expect(manifest).toContain("@fontsource-variable/jetbrains-mono");
  });
});
