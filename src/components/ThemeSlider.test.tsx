import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import chrome from "../content/chrome.json";
import type { Locale } from "../i18n/locales";
import ThemeSlider, { chooseWithSound, orientationFromFlexDirection } from "./ThemeSlider";

const render = (locale: Locale): string =>
  renderToStaticMarkup(<ThemeSlider copy={chrome[locale].theme} />);

const run = (stop: "light" | "auto" | "dark" | undefined) => {
  const played: string[] = [];
  const stored: string[] = [];
  chooseWithSound(
    stop,
    "auto",
    {
      play: (event) => {
        played.push(event);
      },
    },
    (picked) => {
      stored.push(picked);
    },
  );
  return { played, stored };
};

describe("chooseWithSound", () => {
  test("stores the stop and plays theme once when it changes", () => {
    expect(run("dark")).toEqual({ played: ["theme"], stored: ["dark"] });
  });

  test("stores but stays silent when the stop is the current one", () => {
    expect(run("auto")).toEqual({ played: [], stored: ["auto"] });
  });

  test("does nothing without a stop", () => {
    expect(run(undefined)).toEqual({ played: [], stored: [] });
  });
});

describe("ThemeSlider", () => {
  test("exposes the bar as a slider over the three stops, horizontal before hydration", () => {
    const html = render("en");
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="2"');
    expect(html).toContain('aria-valuetext="Auto"');
    expect(html).toContain('tabindex="0"');
  });

  test("lists the tabs as Light, Auto, Dark with the current one pressed", () => {
    const html = render("en");
    const positions = ["Light", "Auto", "Dark"].map((name) =>
      html.indexOf(`</span>${name}</button>`),
    );
    expect(positions.every((position) => position > -1)).toBe(true);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  test("names the theme sound on each tab and leaves the bar to its own calls", () => {
    const html = render("en");
    expect(html.match(/data-sound="theme"/g)).toHaveLength(3);
  });

  test("centres each tab label and leaves the layout to the container query", () => {
    const html = render("en");
    expect(html).toContain("items-center justify-center");
    expect(html).toContain("text-center font-mono font-bold");
    expect(html).toContain('class="theme-control"');
    expect(html).not.toContain("flex-col");
  });

  test("marks the indicator and the bar with the stored stop, never inline style", () => {
    const html = render("en");
    expect(html.match(/data-stop="auto"/g)).toHaveLength(2);
    expect(html).not.toContain("style=");
  });

  test("starts at rest: the bar is not dragging and carries no drag level", () => {
    const html = render("en");
    expect(html).toContain('data-dragging="false"');
    expect(html).not.toContain("--drag-level");
  });

  test("keeps decorative icons out of the accessibility tree", () => {
    const html = render("en");
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(4);
  });

  test("translates the labels", () => {
    const html = render("es");
    expect(html).toContain(`aria-label="${chrome.es.theme.label}"`);
    expect(html).toContain(chrome.es.theme.dark);
  });
});

describe("orientationFromFlexDirection", () => {
  test("a row is the vertical bar beside the tabs, from lg up", () => {
    expect(orientationFromFlexDirection("row")).toBe("vertical");
  });

  test("a column is the horizontal bar under the tabs, below lg", () => {
    expect(orientationFromFlexDirection("column")).toBe("horizontal");
    expect(orientationFromFlexDirection("")).toBe("horizontal");
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
  "MutationObserver",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
] as const;

const BAR_SIZE = 300;

const noop = (): void => undefined;
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
const mounted: Root[] = [];
const resizeCallbacks = new Set<() => void>();
const layout = { flexDirection: "column", disconnected: 0 };
const domWindow = new Window({ url: "http://localhost/" });

class StubResizeObserver {
  private readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
  }

  observe(): void {
    resizeCallbacks.add(this.callback);
  }

  disconnect(): void {
    layout.disconnected += 1;
    resizeCallbacks.delete(this.callback);
  }
}

const stubMatchMedia = (mediaQuery: string) => ({
  matches: false,
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

interface FireOptions {
  isTrusted?: boolean;
  init?: object;
}

const fire = (
  target: Element,
  type: string,
  { isTrusted = false, init = {} }: FireOptions = {},
): Event => {
  const EventType = type.startsWith("key") ? domWindow.KeyboardEvent : domWindow.PointerEvent;
  const event = new EventType(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  Object.defineProperty(event, "isTrusted", { value: isTrusted });
  act(() => {
    target.dispatchEvent(event as unknown as Event);
  });
  return event as unknown as Event;
};

const query = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const mountSlider = (): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  act(() => {
    root.render(<ThemeSlider copy={chrome.en.theme} />);
  });
  const bar = query("[data-theme-slider]");
  Object.defineProperties(bar, {
    getBoundingClientRect: {
      value: () => ({ left: 0, top: 0, width: BAR_SIZE, height: BAR_SIZE }),
    },
    setPointerCapture: { value: noop },
  });
  return bar;
};

const unmountAll = (): void => {
  act(() => {
    for (const root of mounted) root.unmount();
  });
  mounted.length = 0;
};

const stored = (): string | null => localStorage.getItem("theme");

describe("ThemeSlider in a DOM", () => {
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
    defineGlobal("getComputedStyle", () => ({
      flexDirection: layout.flexDirection,
    }));
    defineGlobal("ResizeObserver", StubResizeObserver);
    defineGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    unmountAll();
    document.body.replaceChildren();
    localStorage.clear();
    layout.flexDirection = "column";
    layout.disconnected = 0;
    resizeCallbacks.clear();
    document.documentElement.className = "";
  });

  afterAll(() => {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  test("marks the tab of the stored stop and stores a tab press", () => {
    mountSlider();
    expect(query("[data-tab=auto]").getAttribute("aria-pressed")).toBe("true");
    act(() => {
      query("[data-tab=dark]").click();
    });
    expect(stored()).toBe("dark");
    expect(query("[data-tab=dark]").getAttribute("aria-pressed")).toBe("true");
    expect(query("[data-theme-slider]").getAttribute("aria-valuenow")).toBe("2");
  });

  test("steps between the stops with the arrow keys and ignores other keys", () => {
    const bar = mountSlider();
    const ignored = fire(bar, "keydown", { init: { key: "a" } });
    expect(ignored.defaultPrevented).toBe(false);
    expect(stored()).toBeNull();
    const stepped = fire(bar, "keydown", { init: { key: "ArrowLeft" } });
    expect(stepped.defaultPrevented).toBe(true);
    expect(stored()).toBe("dark");
    fire(bar, "keydown", { init: { key: "Home" } });
    expect(stored()).toBe("light");
  });

  test("picks the stop under a replayed press and follows it while the button is held", () => {
    const bar = mountSlider();
    fire(bar, "pointermove", { init: { buttons: 1, clientX: 10 } });
    expect(stored()).toBeNull();
    fire(bar, "pointerdown", { init: { clientX: 10 } });
    expect(stored()).toBe("dark");
    expect(bar.dataset.dragging).toBe("false");
    fire(bar, "pointermove", { init: { buttons: 0, clientX: 290 } });
    expect(stored()).toBe("dark");
    fire(bar, "pointermove", { init: { buttons: 1, clientX: 290 } });
    expect(stored()).toBe("light");
    fire(bar, "pointerup");
    fire(bar, "pointermove", { init: { buttons: 1, clientX: 10 } });
    expect(stored()).toBe("light");
  });

  test("drags with a real press, showing the live level until release stores the stop", () => {
    const bar = mountSlider();
    fire(bar, "pointerdown", { isTrusted: true, init: { clientX: 150 } });
    expect(bar.dataset.dragging).toBe("true");
    expect(bar.style.getPropertyValue("--drag-level")).toBe("50");
    fire(bar, "pointermove", { init: { clientX: 15 } });
    expect(Number(bar.style.getPropertyValue("--drag-level"))).toBeCloseTo(5);
    expect(stored()).toBeNull();
    fire(bar, "pointerup");
    expect(bar.dataset.dragging).toBe("false");
    expect(bar.style.getPropertyValue("--drag-level")).toBe("");
    expect(stored()).toBe("dark");
  });

  test("drops a cancelled drag without storing anything", () => {
    const bar = mountSlider();
    fire(bar, "pointerdown", { isTrusted: true, init: { clientX: 290 } });
    fire(bar, "pointercancel");
    expect(bar.dataset.dragging).toBe("false");
    expect(bar.style.getPropertyValue("--drag-level")).toBe("");
    expect(stored()).toBeNull();
  });

  test("ignores a release or a cancel when no drag is running", () => {
    const bar = mountSlider();
    fire(bar, "pointerup");
    fire(bar, "pointercancel");
    expect(stored()).toBeNull();
    expect(bar.dataset.dragging).toBe("false");
  });

  test("reads the vertical bar from a row layout and measures along Y", () => {
    layout.flexDirection = "row";
    const bar = mountSlider();
    expect(bar.getAttribute("aria-orientation")).toBe("vertical");
    fire(bar, "pointerdown", { init: { clientX: 0, clientY: 10 } });
    expect(stored()).toBe("light");
  });

  test("follows the layout when the control resizes and stops observing on unmount", () => {
    const bar = mountSlider();
    expect(bar.getAttribute("aria-orientation")).toBe("horizontal");
    layout.flexDirection = "row";
    act(() => {
      for (const callback of resizeCallbacks) callback();
    });
    expect(bar.getAttribute("aria-orientation")).toBe("vertical");
    unmountAll();
    expect(layout.disconnected).toBe(1);
  });
});
