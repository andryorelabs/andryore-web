import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import about from "../content/about.json";
import type { Locale } from "../i18n/locales";
import { CV_PATHS } from "../lib/contact";

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
  "DocumentFragment",
  "MutationObserver",
  "DOMRect",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
] as const;

const noop = (): void => undefined;

class StubResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
const mounted: Root[] = [];
const domWindow = new Window({ url: "http://localhost/" });

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

const domSource = domWindow as unknown as Record<string, unknown>;
for (const key of DOM_KEYS) {
  const value = key === "window" ? domWindow : domSource[key];
  defineGlobal(
    key,
    isFunctionMember(key, value) ? (value as () => unknown).bind(domWindow) : value,
  );
}
defineGlobal("ResizeObserver", StubResizeObserver);
defineGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const { default: CvSplitButton } = await import("./CvSplitButton");

const render = (locale: Locale): string =>
  renderToStaticMarkup(<CvSplitButton locale={locale} copy={about[locale]} />);

describe("CvSplitButton", () => {
  test("downloads the page language by default", () => {
    expect(render("en")).toContain(`href="${CV_PATHS.en}"`);
    expect(render("es")).toContain(`href="${CV_PATHS.es}"`);
  });

  test("names the file and the language for assistive technology", () => {
    const html = render("en");
    expect(html).toContain(`download="${about.en.cvEnglishFile}"`);
    expect(html).toContain(about.en.cvEnglishOption);
    expect(html).toContain(`aria-label="${about.en.cvMenuLabel}"`);
    expect(render("es")).toContain(`aria-label="${about.es.cvMenuLabel}"`);
  });

  test("plays the cv sound on the download only, the menu keeps the click", () => {
    const html = render("en");
    expect(html).toContain('data-sound="cv"');
    expect(html.match(/data-sound=/g)).toHaveLength(1);
  });

  test("shows the language of the file next to the label", () => {
    expect(render("en")).toContain("CV · EN");
    expect(render("es")).toContain("CV · ES");
  });

  test("labels the group and both file options like the canvas", () => {
    expect(about.en.cvGroupLabel).toBe("Download CV");
    expect(about.es.cvGroupLabel).toBe("Descargar CV");
    expect(about.en.cvEnglishOption).toBe("English (PDF)");
    expect(about.en.cvSpanishOption).toBe("Spanish (PDF)");
    expect(about.es.cvEnglishOption).toBe("Inglés (PDF)");
    expect(about.es.cvSpanishOption).toBe("Español (PDF)");
    expect(render("en")).toContain('aria-label="Download CV"');
  });

  test("tracks the download by language", () => {
    expect(render("es")).toContain('data-umami-event-language="es"');
  });
});

const press = (target: Element, key: string): void => {
  act(() => {
    target.dispatchEvent(
      new domWindow.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      }) as unknown as Event,
    );
  });
};

const mountButton = (): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  act(() => {
    root.render(<CvSplitButton locale="en" copy={about.en} />);
  });
  const trigger = container.querySelector<HTMLElement>("[data-cv-menu-trigger]");
  if (!trigger) throw new Error("missing menu trigger");
  return trigger;
};

const download = (): HTMLAnchorElement => {
  const link = document.querySelector<HTMLAnchorElement>("[data-cv-download]");
  if (!link) throw new Error("missing download link");
  return link;
};

const option = (language: Locale): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>("[data-cv-option]")].find(
    (item) => item.dataset.cvOption === language,
  );
  if (!found) throw new Error(`missing option ${language}`);
  return found;
};

describe("CvSplitButton in a DOM", () => {
  afterEach(() => {
    act(() => {
      for (const root of mounted) root.unmount();
    });
    mounted.length = 0;
    localStorage.clear();
    document.body.replaceChildren();
  });

  afterAll(() => {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  test("downloads the page language until another one is chosen", () => {
    mountButton();
    expect(download().getAttribute("href")).toBe(CV_PATHS.en);
  });

  test("switches the download to the language picked in the menu and remembers it", () => {
    const trigger = mountButton();
    press(trigger, "ArrowDown");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      option("es").click();
    });
    expect(download().getAttribute("href")).toBe(CV_PATHS.es);
    expect(download().getAttribute("download")).toBe(about.en.cvSpanishFile);
    expect(localStorage.getItem("andryore:cv-language")).toBe("es");
  });

  test("starts from the remembered language over the page one", () => {
    localStorage.setItem("andryore:cv-language", "es");
    mountButton();
    expect(download().getAttribute("href")).toBe(CV_PATHS.es);
    expect(download().textContent).toContain("CV · ES");
  });

  test("removes the button on unmount", () => {
    mountButton();
    act(() => {
      for (const root of mounted) root.unmount();
    });
    mounted.length = 0;
    expect(document.querySelector("[data-cv-split]")).toBeNull();
  });
});
