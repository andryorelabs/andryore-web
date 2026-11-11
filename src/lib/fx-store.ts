/**
The localStorage key of the Sound preference.
 */
export const FX_STORAGE_KEY = "ao-fx2";

/**
The slice of `Storage` the Sound preference needs.
 */
export interface FxStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
The event dispatched on the window whenever the Sound choice changes.
 */
const FX_CHANGE_EVENT = "ao-fx-change";

const noop = (): void => {
  return;
};

const memory: { enabled: boolean; unsaved: boolean } = {
  enabled: false,
  unsaved: false,
};

/**
 * Reaches `localStorage` without throwing; merely touching it can throw when
 * site data is blocked.
 * @param win Anything that may expose `localStorage`.
 * @returns The storage, or undefined when it is unavailable.
 */
export function getFxStorage(
  win: Readonly<{ localStorage?: FxStorage }> = globalThis,
): FxStorage | undefined {
  try {
    return win.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Reads whether Sound is on. Off is the default, and an unreadable store
 * or unsaved store falls back to the choice made earlier in this page.
 * @param storage The storage to read, if any.
 * @returns True only when the stored value is "on".
 */
export function isFxEnabled(storage: FxStorage | undefined): boolean {
  if (!storage || memory.unsaved) return memory.enabled;
  try {
    return storage.getItem(FX_STORAGE_KEY) === "on";
  } catch {
    return memory.enabled;
  }
}

/**
 * Mirrors the Sound choice on `<html data-fx>`, which the dock reads before it
 * hydrates. The inline theme script sets it on load.
 * @param isEnabled Whether Sound is on.
 */
function paintFxRoot(isEnabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fx = isEnabled ? "on" : "off";
}

/**
 * Stores the Sound choice, keeping it in memory when storage fails.
 * @param storage The storage to write, if any.
 * @param isEnabled Whether Sound is on.
 */
export function writeFx(storage: FxStorage | undefined, isEnabled: boolean): void {
  memory.enabled = isEnabled;
  try {
    storage?.setItem(FX_STORAGE_KEY, isEnabled ? "on" : "off");
    memory.unsaved = false;
  } catch {
    memory.unsaved = true;
  } finally {
    paintFxRoot(isEnabled);
    if (typeof globalThis.dispatchEvent === "function")
      globalThis.dispatchEvent(new Event(FX_CHANGE_EVENT));
  }
}

/**
 * Subscribes to Sound changes made in this page or in another tab.
 * @param onChange Called after every change.
 * @returns A function that removes the subscription.
 */
export function subscribeFx(onChange: () => void): () => void {
  if (typeof globalThis.addEventListener !== "function") return noop;
  globalThis.addEventListener(FX_CHANGE_EVENT, onChange);
  globalThis.addEventListener("storage", onChange);
  return () => {
    globalThis.removeEventListener(FX_CHANGE_EVENT, onChange);
    globalThis.removeEventListener("storage", onChange);
  };
}
