import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import { ThemeIcon, useThemePreference } from "./ThemeToggle";

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
  "getComputedStyle",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
] as const;

const saved = new Map<string, PropertyDescriptor | undefined>();
const mounted: Root[] = [];
const scheme = { current: "light" as "dark" | "light" };
const queryListeners = new Set<() => void>();

const stubMatchMedia = (query: string) => ({
  matches: query.includes("dark") && scheme.current === "dark",
  media: query,
  addEventListener: (_type: string, listener: () => void) => {
    queryListeners.add(listener);
  },
  removeEventListener: (_type: string, listener: () => void) => {
    queryListeners.delete(listener);
  },
});

const define = (key: string, value: unknown): void => {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
};

beforeAll(() => {
  const domWindow = new Window({ url: "http://localhost/" });
  const source = domWindow as unknown as Record<string, unknown>;
  for (const key of DOM_KEYS) {
    const value = key === "window" ? domWindow : source[key];
    define(key, typeof value === "function" ? (value as () => unknown).bind(domWindow) : value);
  }
  define("matchMedia", stubMatchMedia);
  define("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => {
    for (const root of mounted) root.unmount();
  });
  mounted.length = 0;
  localStorage.clear();
  queryListeners.clear();
  scheme.current = "light";
  document.documentElement.classList.remove("dark");
});

afterAll(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function Probe() {
  return <output>{useThemePreference()}</output>;
}

const mountProbe = (): string => {
  const container = document.createElement("div");
  const root = createRoot(container);
  mounted.push(root);
  act(() => {
    root.render(<Probe />);
  });
  return container.textContent;
};

describe("ThemeIcon", () => {
  test.each(["auto", "light", "dark"] as const)("draws a decorative %s icon", (preference) => {
    const html = renderToStaticMarkup(<ThemeIcon preference={preference} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<svg");
  });
});

describe("useThemePreference", () => {
  test("reads auto when nothing is stored", () => {
    expect(mountProbe()).toBe("auto");
  });

  test("reads the stored preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(mountProbe()).toBe("dark");
  });

  test("listens to the system scheme and stops on unmount", () => {
    mountProbe();
    expect(queryListeners.size).toBe(1);
    scheme.current = "dark";
    act(() => {
      for (const listener of queryListeners) listener();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => {
      for (const root of mounted) root.unmount();
    });
    mounted.length = 0;
    expect(queryListeners.size).toBe(0);
  });
});
