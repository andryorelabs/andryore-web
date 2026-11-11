import { getFxStorage, isFxEnabled, subscribeFx, type FxStorage } from "../lib/fx-store";

/**
The parts of the dock Sound switch the pre-hydration paint touches.
 */
export interface DockSoundElement {
  setAttribute: (name: string, value: string) => void;
}

/**
 * Paints `aria-checked` on the dock Sound switch from the stored choice, so
 * assistive technology hears the right state before the Dock island hydrates.
 * It only paints; the island owns the click.
 * @param element The switch element, if the page has a dock.
 * @param storage The storage to read; defaults to `localStorage` when usable.
 */
export function mountDockSoundState(
  element: DockSoundElement | null,
  storage: FxStorage | undefined = getFxStorage(),
): void {
  if (!element) return;
  const paint = (): void => {
    element.setAttribute("aria-checked", String(isFxEnabled(storage)));
  };
  paint();
  subscribeFx(paint);
}
