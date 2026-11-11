import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import chrome from "../content/chrome.json";
import type { Locale } from "../i18n/locales";
import Dock, { LanguageMenu, SoundSwitch, ThemeMenu } from "./Dock";

function render(locale: Locale, path: string): string {
  return renderToStaticMarkup(
    <Dock
      copy={chrome[locale].dock}
      themeCopy={chrome[locale].theme}
      locale={locale}
      path={path}
    />,
  );
}

describe("Dock", () => {
  test("gives every control an accessible name in English", () => {
    const html = render("en", "/");
    for (const name of [
      "Home",
      "Products",
      "About",
      "Uses",
      "Find me",
      "EN Language",
      "Theme",
      "Sound",
    ]) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    expect(html).toContain('aria-label="Main"');
  });

  test("uses the canvas dock geometry from sm and a compact one on phones", () => {
    const html = render("en", "/");
    expect(html).toContain("sm:gap-1");
    expect(html).toContain("sm:p-2");
    expect(html).toContain("gap-0 rounded-pill");
    expect(html).toContain("data-dock-nav");
  });

  test("orders the items as the canvas does", () => {
    const html = render("en", "/");
    const names = ["Home", "About", "Products", "Uses", "Find me", "EN Language", "Theme", "Sound"];
    const positions = names.map((name) => html.indexOf(`aria-label="${name}"`));
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(positions.every((position) => position >= 0)).toBe(true);
  });

  test("links Find me to the home anchor in each language", () => {
    expect(render("en", "/about/")).toContain('href="/#find-me"');
    expect(render("es", "/")).toContain('href="/es/#find-me"');
  });

  test("renders Sound off by default as a switch", () => {
    const html = render("en", "/");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain("Sound off");
    expect(html).toContain('data-fx="off"');
  });

  test("localises names and links in Spanish", () => {
    const html = render("es", "/about/");
    expect(html).toContain('aria-label="Inicio"');
    expect(html).toContain('aria-label="ES Idioma"');
    expect(html).toContain('href="/es/about/"');
    expect(html).toContain('href="/es/#products"');
  });

  test("marks only the current page and draws the pill on it", () => {
    const html = render("en", "/about/");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/data-dock-pill/g)).toHaveLength(5);
    expect(html).toMatch(/href="\/about\/"[^>]*aria-current="page"/);
  });

  test.each<[Locale, string, string]>([
    ["en", "/", "home"],
    ["es", "/", "home"],
    ["en", "/about/", "about"],
    ["es", "/about/", "about"],
    ["en", "/uses/", "uses"],
    ["es", "/uses/", "uses"],
    ["en", "/products/snug/", "products"],
    ["es", "/products/snug/", "products"],
  ])("%s %s marks %s", (locale, path, key) => {
    const html = render(locale, path);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`aria-current="page"[^>]*data-dock-page="${key}"`));
  });

  test.each<[Locale, string]>([
    ["en", "/404/"],
    ["es", "/404/"],
  ])("%s %s marks no page", (locale, path) => {
    expect(render(locale, path)).not.toContain('aria-current="page"');
  });

  test("tags every page link for the home scroll spy", () => {
    const html = render("en", "/");
    expect(html.match(/data-dock-page="/g)).toHaveLength(5);
  });

  test("marks no page on a page the dock does not list", () => {
    expect(render("en", "/colophon/")).not.toContain("aria-current");
  });

  test("keeps both menus closed on first render", () => {
    const html = render("en", "/");
    expect(html).not.toContain('role="menu"');
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(2);
  });
});

describe("LanguageMenu", () => {
  test("links the same page in each language and marks the current one", () => {
    const html = renderToStaticMarkup(
      <LanguageMenu copy={chrome.es.dock.language} locale="es" path="/about/" />,
    );
    expect(html).toContain('role="menu"');
    expect(html).toContain('href="/about/"');
    expect(html).toContain('href="/es/about/"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/es\/about\/"[^>]*aria-current/);
    expect(html).toContain('data-locale-switch="en"');
  });
});

describe("ThemeMenu", () => {
  test("offers auto, light and dark as radios with the stored one checked", () => {
    const html = renderToStaticMarkup(
      <ThemeMenu copy={chrome.en.theme} preference="dark" onChoose={mock()} />,
    );
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*>Dark</);
  });
});

describe("sound triggers", () => {
  test("names the switch sound on the dock Sound switch", () => {
    const html = render("en", "/");
    expect(html).toContain('data-dock-sound="true"');
    expect(html.match(/data-sound="switch"/g)).toHaveLength(1);
  });

  test("names the theme sound on every theme option", () => {
    const html = renderToStaticMarkup(
      <ThemeMenu copy={chrome.en.theme} preference="dark" onChoose={mock()} />,
    );
    expect(html.match(/data-sound="theme"/g)).toHaveLength(3);
  });

  test("leaves language links and dock buttons on the default click", () => {
    const html = renderToStaticMarkup(
      <LanguageMenu copy={chrome.en.dock.language} locale="en" path="/" />,
    );
    expect(html).not.toContain("data-sound=");
  });
});

const renderSwitch = (availability: "unknown" | "available" | "unavailable") =>
  renderToStaticMarkup(
    <SoundSwitch
      copy={chrome.en.dock.sound}
      enabled={false}
      availability={availability}
      onToggle={mock()}
    />,
  );

describe("SoundSwitch availability", () => {
  test("renders while availability is unknown or available", () => {
    expect(renderSwitch("unknown")).toContain("data-dock-sound");
    expect(renderSwitch("available")).toContain("data-dock-sound");
  });

  test("gives up its slot once the audio files are missing", () => {
    const html = renderSwitch("unavailable");
    expect(html).toContain("data-sound-unavailable");
    expect(html).toMatch(/class="[^"]*\bhidden\b/);
    expect(html).not.toContain("invisible");
    expect(renderSwitch("available")).not.toContain("data-sound-unavailable");
  });
});

describe("SoundSwitch", () => {
  test("shows the dot, the checked state and the on tooltip when on", () => {
    const html = renderToStaticMarkup(
      <SoundSwitch copy={chrome.es.dock.sound} enabled onToggle={mock()} />,
    );
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("data-dock-sound-dot");
    expect(html).toContain("Sonido activado");
    expect(html).toContain('data-fx="on"');
  });

  test("renders both variants so CSS can pick one before hydration", () => {
    const html = renderSwitch("unknown");
    expect(html).toContain('data-fx="off"');
    expect(html.match(/data-sound-state="on"/g)).toHaveLength(3);
    expect(html.match(/data-sound-state="off"/g)).toHaveLength(2);
  });
});

describe("Dock pre-hydration state", () => {
  test("is not ready on the server and renders all three theme icons", () => {
    const html = render("en", "/about/");
    expect(html).not.toContain("data-ready");
    for (const option of ["auto", "light", "dark"])
      expect(html).toContain(`data-theme-icon="${option}"`);
  });
});
