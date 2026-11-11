import { magnificationScale } from "./dock";
import { isMotionReduced } from "./motion";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

interface ScaleTarget {
  style: {
    transform: string;
    removeProperty: (name: string) => unknown;
  };
  getBoundingClientRect: () => { left: number; width: number };
}

interface MediaWindow {
  matchMedia: (query: string) => { matches: boolean };
}

/**
 * Scales dock items around the pointer, or clears the scale.
 * @param items The elements to scale.
 * @param pointerX Pointer position in viewport pixels; undefined clears.
 */
export function magnifyItems(items: Iterable<ScaleTarget>, pointerX: number | undefined): void {
  for (const item of items) {
    if (pointerX === undefined) {
      item.style.removeProperty("transform");
      continue;
    }
    const box = item.getBoundingClientRect();
    const scale = magnificationScale(pointerX - (box.left + box.width / 2));
    item.style.transform = `scale(${scale.toFixed(3)})`;
  }
}

/**
 * Whether pointer magnification applies: a mouse on a device with fine
 * hover, and no request for reduced motion.
 * @param win Anything with a `matchMedia`.
 * @param pointerType The `pointerType` of the event.
 * @returns True when items should magnify.
 */
export function shouldMagnify(win: MediaWindow, pointerType: string): boolean {
  return (
    pointerType === "mouse" && win.matchMedia(FINE_POINTER_QUERY).matches && !isMotionReduced(win)
  );
}

/**
 * Index to focus after a key press inside a menu.
 * @param count Number of menu items.
 * @param current Index of the focused item, or -1 when none is focused.
 * @param key The `KeyboardEvent.key`.
 * @returns The target index, or undefined when the key does not navigate.
 */
export function nextMenuIndex(count: number, current: number, key: string): number | undefined {
  if (count === 0) return undefined;
  const targets: Record<string, number> = {
    ArrowDown: (current + 1) % count,
    ArrowUp: (current - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  return targets[key];
}

export type DockMenuName = "language" | "theme";

interface Focusable {
  focus: () => void;
}

interface MenuRoot {
  querySelector: (selector: string) => Focusable | null;
  querySelectorAll: (selector: string) => Iterable<Focusable>;
}

const TRIGGER_SELECTORS: Record<DockMenuName, string> = {
  language: '[data-dock-trigger="language"]',
  theme: '[data-dock-trigger="theme"]',
};

const ITEM_SELECTORS: Record<DockMenuName, string> = {
  language: '[data-dock-menu="language"] [role^="menuitem"]',
  theme: '[data-dock-menu="theme"] [role^="menuitem"]',
};

const SELECTED_SELECTORS: Record<DockMenuName, string> = {
  language: '[data-dock-menu="language"] [aria-current="true"]',
  theme: '[data-dock-menu="theme"] [aria-checked="true"]',
};

/**
 * Returns focus to the button that opened a menu.
 * @param root The dock element.
 * @param name The menu whose trigger to focus.
 */
export function focusTrigger(root: MenuRoot, name: DockMenuName): void {
  root.querySelector(TRIGGER_SELECTORS[name])?.focus();
}

/**
 * Moves focus into a freshly opened menu: the selected item, else the first.
 * @param root The dock element.
 * @param name The menu that opened.
 */
export function focusInitialItem(root: MenuRoot, name: DockMenuName): void {
  const selected = root.querySelector(SELECTED_SELECTORS[name]);
  const [first] = root.querySelectorAll(ITEM_SELECTORS[name]);
  (selected ?? first)?.focus();
}

/**
 * Handles a navigation key inside an open menu.
 * @param root The dock element.
 * @param name The open menu.
 * @param key The `KeyboardEvent.key`.
 * @param active The currently focused element.
 * @returns True when the key moved focus and should not scroll the page.
 */
export function didMoveInMenu(
  root: MenuRoot,
  name: DockMenuName,
  key: string,
  active: unknown,
): boolean {
  const items = [...root.querySelectorAll(ITEM_SELECTORS[name])];
  const next = nextMenuIndex(items.length, items.indexOf(active as Focusable), key);
  if (next === undefined) return false;
  items[next]?.focus();
  return true;
}
