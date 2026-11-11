import { getFxStorage, isFxEnabled, subscribeFx, writeFx, type FxStorage } from "../lib/fx-store";

/**
The parts of the switch element the script touches, so tests can fake it.
 */
export interface FxSwitchElement {
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: "click", listener: () => void) => void;
}

/**
 * Reflects the stored Sound choice on the switch and toggles it on click.
 * The switch sound comes from the page-level sound triggers, which run after
 * this listener has stored the choice.
 * @param element Element that carries `role="switch"`.
 * @param storage The storage to use; defaults to `localStorage` when usable.
 */
export function mountFxSwitch(
  element: FxSwitchElement,
  storage: FxStorage | undefined = getFxStorage(),
): void {
  const paint = (): void => {
    element.setAttribute("aria-checked", String(isFxEnabled(storage)));
  };
  paint();
  subscribeFx(paint);
  element.addEventListener("click", () => {
    writeFx(storage, !isFxEnabled(storage));
  });
}

/**
The parts of the tile root the availability script touches.
 */
export interface FxTileElement {
  toggleAttribute: (name: string, isForced: boolean) => boolean;
}

/**
The slice of the sound engine the FX tile reads.
 */
export interface FxAvailabilitySource {
  getAvailability: () => "unknown" | "available" | "unavailable";
  subscribeAvailability: (onChange: () => void) => () => void;
}

/**
 * Hides the FX tile once the audio files are known to be missing. The tile
 * keeps its box, so nothing around it moves.
 * @param element The tile root.
 * @param source The sound engine, or a fake of its availability.
 */
export function mountFxAvailability(element: FxTileElement, source: FxAvailabilitySource): void {
  const paint = (): void => {
    element.toggleAttribute("data-sound-unavailable", source.getAvailability() === "unavailable");
  };
  paint();
  source.subscribeAvailability(paint);
}
