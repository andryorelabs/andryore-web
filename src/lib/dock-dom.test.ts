import { describe, expect, test } from "bun:test";

import { MAGNIFICATION_MAX_SCALE } from "./dock";
import {
  focusInitialItem,
  focusTrigger,
  magnifyItems,
  didMoveInMenu,
  nextMenuIndex,
  shouldMagnify,
} from "./dock-dom";

const ITEM_WIDTH = 44;

function fakeItem(left: number) {
  const removed: string[] = [];
  return {
    removed,
    style: {
      transform: "",
      removeProperty: (name: string) => {
        removed.push(name);
      },
    },
    getBoundingClientRect: () => ({ left, width: ITEM_WIDTH }),
  };
}

describe("magnifyItems", () => {
  test("scales the item under the pointer most and distant ones not at all", () => {
    const near = fakeItem(0);
    const far = fakeItem(400);
    magnifyItems([near, far], 22);
    expect(near.style.transform).toBe(`scale(${MAGNIFICATION_MAX_SCALE.toFixed(3)})`);
    expect(far.style.transform).toBe("scale(1.000)");
  });

  test("clears the transform when the pointer leaves", () => {
    const item = fakeItem(0);
    magnifyItems([item], undefined);
    expect(item.removed).toEqual(["transform"]);
  });
});

const windowWith = (canHover: boolean, isReduced: boolean) => ({
  matchMedia: (query: string) => ({
    matches: query.includes("reduce") ? isReduced : canHover,
  }),
});

describe("shouldMagnify", () => {
  test("magnifies for a mouse with fine hover and no reduced motion", () => {
    expect(shouldMagnify(windowWith(true, false), "mouse")).toBe(true);
  });

  test.each([
    ["touch pointer", windowWith(true, false), "touch"],
    ["no fine hover", windowWith(false, false), "mouse"],
    ["reduced motion", windowWith(true, true), "mouse"],
  ])("does not magnify with %s", (_name, win, pointerType) => {
    expect(shouldMagnify(win, pointerType)).toBe(false);
  });
});

describe("nextMenuIndex", () => {
  test("wraps around with the arrow keys", () => {
    expect(nextMenuIndex(3, 2, "ArrowDown")).toBe(0);
    expect(nextMenuIndex(3, 0, "ArrowUp")).toBe(2);
    expect(nextMenuIndex(3, 0, "ArrowDown")).toBe(1);
  });

  test("jumps with Home and End", () => {
    expect(nextMenuIndex(3, 1, "Home")).toBe(0);
    expect(nextMenuIndex(3, 1, "End")).toBe(2);
  });

  test("ignores other keys and empty menus", () => {
    expect(nextMenuIndex(3, 1, "a")).toBeUndefined();
    expect(nextMenuIndex(0, -1, "ArrowDown")).toBeUndefined();
  });
});

function fakeFocusable() {
  const state = { focused: 0 };
  return {
    state,
    focus: () => {
      state.focused += 1;
    },
  };
}

function fakeRoot(selectors: Record<string, ReturnType<typeof fakeFocusable>[]>) {
  return {
    querySelector: (selector: string) => selectors[selector]?.[0] ?? null,
    querySelectorAll: (selector: string) => selectors[selector] ?? [],
  };
}

describe("menu focus", () => {
  test("focusTrigger focuses the trigger of the menu", () => {
    const trigger = fakeFocusable();
    focusTrigger(fakeRoot({ '[data-dock-trigger="theme"]': [trigger] }), "theme");
    expect(trigger.state.focused).toBe(1);
  });

  test("focusInitialItem prefers the selected item, else the first", () => {
    const first = fakeFocusable();
    const selected = fakeFocusable();
    const items = {
      '[data-dock-menu="language"] [role^="menuitem"]': [first, selected],
    };
    focusInitialItem(fakeRoot(items), "language");
    expect(first.state.focused).toBe(1);
    focusInitialItem(
      fakeRoot({
        ...items,
        '[data-dock-menu="language"] [aria-current="true"]': [selected],
      }),
      "language",
    );
    expect(selected.state.focused).toBe(1);
    expect(first.state.focused).toBe(1);
  });

  test("didMoveInMenu moves focus and reports whether it handled the key", () => {
    const one = fakeFocusable();
    const two = fakeFocusable();
    const root = fakeRoot({
      '[data-dock-menu="theme"] [role^="menuitem"]': [one, two],
    });
    expect(didMoveInMenu(root, "theme", "ArrowDown", one)).toBe(true);
    expect(two.state.focused).toBe(1);
    expect(didMoveInMenu(root, "theme", "x", one)).toBe(false);
  });
});
