export const LOCALE_SCROLL_KEY = "locale-scroll";

/**
Selectors of the page sections a language switch can anchor to.
 */
const LOCALE_SCROLL_ANCHORS: ReadonlySet<string> = new Set([
  "#products",
  '[data-slot="stack-scene"]',
  '[data-slot="live-strip"]',
  "#find-me",
]);

export interface LocaleScrollEntry {
  to: string;
  y: number;
  anchor?: { selector: string; offset: number };
}

export interface AnchorBox {
  selector: string;
  top: number;
  bottom: number;
}

interface ScrollStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ScrollDocument {
  querySelector(selector: string): {
    getBoundingClientRect(): { top: number; bottom: number };
  } | null;
}

interface ScrollWindow {
  scrollY: number;
  scrollTo(options: { top: number; behavior: "instant" }): void;
}

/**
 * Picks the topmost section that is still on screen and how far its top edge
 * sits above the viewport, so the restore can land on the same content when
 * the other language changes the text length.
 * @param boxes Viewport rectangles of the anchor sections.
 * @returns The anchor selector and offset, or undefined when none is visible.
 */
export function pickAnchor(boxes: readonly AnchorBox[]): LocaleScrollEntry["anchor"] {
  const visible = boxes
    .filter((box) => box.bottom > 0)
    .toSorted((first, second) => first.top - second.top)[0];
  return visible ? { selector: visible.selector, offset: -visible.top } : undefined;
}

/**
 * Parses a stored entry, rejecting anything malformed.
 * @param raw The raw session storage value.
 * @returns The entry, or undefined when it is missing or invalid.
 */
export function parseLocaleScroll(raw: string | null | undefined): LocaleScrollEntry | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const { to, y, anchor } = value as Record<string, unknown>;
    if (typeof to !== "string" || typeof y !== "number" || !Number.isFinite(y)) return undefined;
    const parsedAnchor =
      typeof anchor === "object" && anchor !== null
        ? (anchor as Record<string, unknown>)
        : undefined;
    if (
      parsedAnchor &&
      typeof parsedAnchor.selector === "string" &&
      LOCALE_SCROLL_ANCHORS.has(parsedAnchor.selector) &&
      typeof parsedAnchor.offset === "number" &&
      Number.isFinite(parsedAnchor.offset)
    ) {
      return {
        to,
        y,
        anchor: {
          selector: parsedAnchor.selector,
          offset: parsedAnchor.offset,
        },
      };
    }
    return { to, y };
  } catch {
    return undefined;
  }
}

/**
 * Records where the reader is before a language switch navigates away.
 * @param storage Session storage.
 * @param win The window, for the scroll position.
 * @param scrollDocument The document, to measure the anchor sections.
 * @param to Pathname of the other-language page being opened.
 */
export function saveLocaleScroll(
  storage: ScrollStorage,
  win: ScrollWindow,
  scrollDocument: ScrollDocument,
  to: string,
): void {
  const boxes: AnchorBox[] = [];
  for (const selector of LOCALE_SCROLL_ANCHORS) {
    const rect = scrollDocument.querySelector(selector)?.getBoundingClientRect();
    if (rect) boxes.push({ selector, top: rect.top, bottom: rect.bottom });
  }
  const entry: LocaleScrollEntry = {
    to,
    y: win.scrollY,
    anchor: pickAnchor(boxes),
  };
  try {
    storage.setItem(LOCALE_SCROLL_KEY, JSON.stringify(entry));
  } catch {
    return;
  }
}

/**
 * Restores the saved scroll position once, when the page is the one the switch
 * navigated to. The entry is always consumed.
 * @param storage Session storage.
 * @param win The window to scroll.
 * @param scrollDocument The document, to find the anchor section.
 * @param pathname Pathname of the page that just loaded.
 * @returns Whether the page was scrolled.
 */
export function didRestoreLocaleScroll(
  storage: ScrollStorage,
  win: ScrollWindow,
  scrollDocument: ScrollDocument,
  pathname: string,
): boolean {
  let raw: string | undefined;
  try {
    raw = storage.getItem(LOCALE_SCROLL_KEY) ?? undefined;
    storage.removeItem(LOCALE_SCROLL_KEY);
  } catch {
    return false;
  }
  const entry = parseLocaleScroll(raw);
  if (entry?.to !== pathname) return false;
  const rect = entry.anchor
    ? scrollDocument.querySelector(entry.anchor.selector)?.getBoundingClientRect()
    : undefined;
  const top = rect ? rect.top + win.scrollY + (entry.anchor?.offset ?? 0) : entry.y;
  win.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  return true;
}
