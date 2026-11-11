import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  chooseTheme,
  FADE_DURATION_MS,
  getServerThemeSnapshot,
  getThemeSnapshot,
  paintTheme,
  subscribeToTheme,
} from "./theme-store";

const globals = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};
const STUBBED = ["document", "matchMedia", "localStorage"] as const;

function stubBrowser(options: { storage: boolean; dark: boolean }) {
  const classes = new Set<string>();
  const stored = new Map<string, string>();
  globals.document = {
    documentElement: {
      dataset: {} as Record<string, string>,
      classList: {
        add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name),
        toggle: (name: string, shouldForce: boolean) =>
          shouldForce ? classes.add(name) : classes.delete(name),
      },
    },
    querySelectorAll: () => [],
  };
  globals.matchMedia = () => ({ matches: options.dark });
  globals.localStorage = options.storage
    ? {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
        removeItem: (key: string) => stored.delete(key),
      }
    : {
        getItem: () => null,
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      };
  return { classes, stored };
}

beforeEach(() => {
  for (const name of STUBBED) saved[name] = globals[name];
});

afterEach(() => {
  for (const name of STUBBED) globals[name] = saved[name];
});

describe("theme store", () => {
  test("renders auto on the server", () => {
    expect(getServerThemeSnapshot()).toBe("auto");
  });

  test("paints the resolved theme, following the system for auto", () => {
    const { classes } = stubBrowser({ storage: true, dark: true });
    paintTheme("auto");
    expect(classes.has("dark")).toBe(true);
    paintTheme("light");
    expect(classes.has("dark")).toBe(false);
  });

  test("stores the choice, paints it and notifies subscribers", () => {
    const { classes, stored } = stubBrowser({ storage: true, dark: false });
    let notified = 0;
    const unsubscribe = subscribeToTheme(() => {
      notified += 1;
    });
    chooseTheme("dark");
    expect(classes.has("dark")).toBe(true);
    expect(classes.has("theme-fade")).toBe(true);
    expect(stored.get("theme")).toBe("dark");
    expect(getThemeSnapshot()).toBe("dark");
    expect(notified).toBe(1);
    unsubscribe();
    chooseTheme("auto");
    expect(notified).toBe(1);
    expect(getThemeSnapshot()).toBe("auto");
  });

  test("ignores a choice that is already in effect", () => {
    const { classes, stored } = stubBrowser({ storage: true, dark: false });
    chooseTheme("dark");
    classes.delete("theme-fade");
    let notified = 0;
    const unsubscribe = subscribeToTheme(() => {
      notified += 1;
    });
    stored.set("theme", "dark");
    chooseTheme("dark");
    unsubscribe();
    expect(notified).toBe(0);
    expect(classes.has("theme-fade")).toBe(false);
    chooseTheme("auto");
  });

  test("mirrors the choice on the root for the pre-hydration tile", () => {
    stubBrowser({ storage: true, dark: false });
    chooseTheme("light");
    expect(
      (globals.document as { documentElement: { dataset: unknown } }).documentElement.dataset,
    ).toEqual({ themePref: "light" });
    chooseTheme("auto");
  });

  test("keeps the choice in memory when storage is blocked", () => {
    stubBrowser({ storage: false, dark: false });
    chooseTheme("light");
    expect(getThemeSnapshot()).toBe("light");
    stubBrowser({ storage: true, dark: false });
    chooseTheme("auto");
    expect(getThemeSnapshot()).toBe("auto");
  });
});

describe("fade timing", () => {
  test("matches the shared base duration the Theme tile transitions use", () => {
    const tokens = readFileSync("docs/brand/tokens.css", "utf8");
    const base = /--duration-base:\s*(\d+)ms/.exec(tokens);
    expect(Number(base?.[1])).toBe(FADE_DURATION_MS);
  });

  test("the tile transitions use the shared tokens and no layout property", () => {
    const css = readFileSync("src/styles/global.css", "utf8");
    const tile = css.slice(css.indexOf(".theme-indicator {"));
    const rules = tile.slice(0, tile.indexOf("/* Language tile"));
    expect(rules).not.toMatch(/transition:[^;]*\b(height|width|top)\b/);
    expect(rules).not.toMatch(/cubic-bezier/);
    expect(css).not.toMatch(/html\.theme-fade[^{]*\{[^}]*!important/);
  });
});
