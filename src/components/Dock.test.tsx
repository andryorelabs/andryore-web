import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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

const DOM_KEYS = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "FocusEvent",
  "MutationObserver",
  "getComputedStyle",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
] as const;

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

const noop = (): void => undefined;
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
const mounted: Root[] = [];
const pointer = { isFine: false };
const domWindow = new Window({ url: "http://localhost/" });

const stubMatchMedia = (mediaQuery: string) => ({
  matches: mediaQuery === FINE_POINTER_QUERY && pointer.isFine,
  media: mediaQuery,
  addEventListener: noop,
  removeEventListener: noop,
});

const defineGlobal = (key: string, value: unknown): void => {
  savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
};

const isFunctionMember = (key: string, value: unknown): boolean =>
  typeof value === "function" && /^[a-z]/.test(key);

const createEvent = (type: string, init: object): Event => {
  if (type.startsWith("pointer")) return new domWindow.PointerEvent(type, init) as unknown as Event;
  if (type.startsWith("key")) return new domWindow.KeyboardEvent(type, init) as unknown as Event;
  if (type === "focusin") return new domWindow.FocusEvent(type, init) as unknown as Event;
  return new domWindow.MouseEvent(type, init) as unknown as Event;
};

const fire = (target: Element | Document, type: string, init: object = {}): void => {
  act(() => {
    target.dispatchEvent(createEvent(type, { bubbles: true, cancelable: true, ...init }));
  });
};

const query = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const hasOpenMenu = (): boolean => document.querySelector('[role="menu"]') !== null;

const mountDock = (): void => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  act(() => {
    root.render(<Dock copy={chrome.en.dock} themeCopy={chrome.en.theme} locale="en" path="/" />);
  });
};

describe("Dock in a DOM", () => {
  beforeAll(() => {
    const source = domWindow as unknown as Record<string, unknown>;
    for (const key of DOM_KEYS) {
      const value = key === "window" ? domWindow : source[key];
      defineGlobal(
        key,
        isFunctionMember(key, value) ? (value as () => unknown).bind(domWindow) : value,
      );
    }
    defineGlobal("matchMedia", stubMatchMedia);
    defineGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => {
      for (const root of mounted) root.unmount();
    });
    mounted.length = 0;
    document.body.replaceChildren();
    localStorage.clear();
    pointer.isFine = false;
    document.documentElement.className = "";
  });

  afterAll(() => {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  test("opens the language menu, focuses the current language and closes on Escape", () => {
    mountDock();
    const trigger = query('[data-dock-trigger="language"]');
    fire(trigger, "click");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(query('[data-locale-switch="en"]'));
    fire(document, "keydown", { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(hasOpenMenu()).toBe(false);
  });

  test("closes the open menu when its trigger is pressed again", () => {
    mountDock();
    const trigger = query('[data-dock-trigger="theme"]');
    fire(trigger, "click");
    expect(hasOpenMenu()).toBe(true);
    fire(trigger, "click");
    expect(hasOpenMenu()).toBe(false);
  });

  test("moves focus through the menu with the arrow, Home and End keys", () => {
    mountDock();
    fire(query('[data-dock-trigger="theme"]'), "click");
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    expect(document.activeElement).toBe(items[0] ?? null);
    fire(document, "keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1] ?? null);
    fire(document, "keydown", { key: "End" });
    expect(document.activeElement).toBe(items[2] ?? null);
    fire(document, "keydown", { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[1] ?? null);
    fire(document, "keydown", { key: "Home" });
    expect(document.activeElement).toBe(items[0] ?? null);
    fire(document, "keydown", { key: "a" });
    expect(document.activeElement).toBe(items[0] ?? null);
  });

  test("closes the menu on a press or focus outside the dock, not inside it", () => {
    mountDock();
    const trigger = query('[data-dock-trigger="language"]');
    fire(trigger, "click");
    fire(query('[data-locale-switch="es"]'), "pointerdown");
    expect(hasOpenMenu()).toBe(true);
    fire(document.body, "pointerdown");
    expect(hasOpenMenu()).toBe(false);
    fire(trigger, "click");
    fire(document.body, "focusin");
    expect(hasOpenMenu()).toBe(false);
  });

  test("stores the chosen theme, closes the menu and returns focus to its trigger", () => {
    mountDock();
    const trigger = query('[data-dock-trigger="theme"]');
    fire(trigger, "click");
    fire(query('[role="menuitemradio"]:nth-child(3)'), "click");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(hasOpenMenu()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(query('[data-theme-icon="dark"]').dataset.active).toBe("");
  });

  test("switches Sound on and off and stores the choice", () => {
    mountDock();
    const sound = query("[data-dock-sound]");
    expect(sound.getAttribute("aria-checked")).toBe("false");
    fire(sound, "click");
    expect(sound.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem("ao-fx2")).toBe("on");
    fire(sound, "click");
    expect(sound.getAttribute("aria-checked")).toBe("false");
  });

  test("magnifies the items under a mouse and clears them when the pointer leaves", () => {
    pointer.isFine = true;
    mountDock();
    const nav = query("[data-dock-nav]");
    fire(nav, "pointermove", { pointerType: "mouse", clientX: 10 });
    const scaled = [...nav.querySelectorAll<HTMLElement>("[data-dock-scale]")];
    expect(scaled.some((item) => item.style.transform.startsWith("scale("))).toBe(true);
    fire(nav, "pointerout", { relatedTarget: document.body });
    expect(scaled.every((item) => item.style.transform === "")).toBe(true);
  });

  test("leaves items alone for touch pointers", () => {
    pointer.isFine = true;
    mountDock();
    const nav = query("[data-dock-nav]");
    fire(nav, "pointermove", { pointerType: "touch", clientX: 10 });
    expect(
      [...nav.querySelectorAll<HTMLElement>("[data-dock-scale]")].every(
        (item) => item.style.transform === "",
      ),
    ).toBe(true);
  });
});
