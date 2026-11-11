import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { soundEngine, type SoundEngine } from "@/lib/sound-engine";
import type { ThemePreference } from "@/lib/theme";
import { followPointer, pickAtPointer, releaseDrag, type ThemeOrientation } from "@/lib/theme-drag";
import { stopAfterKey, THEME_STOPS } from "@/lib/theme-stops";
import { chooseTheme } from "@/lib/theme-store";
import { cn } from "@/lib/utilities";

import { useThemePreference, type ThemeToggleCopy } from "./ThemeToggle";

const unsubscribeNothing = (): void => undefined;
const subscribeToNothing = (): (() => void) => unsubscribeNothing;
const isHydratedOnClient = (): boolean => true;
const isHydratedOnServer = (): boolean => false;

const RAY_PATH =
  "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4";

const STOP_PATHS: Readonly<Record<ThemePreference, readonly string[]>> = {
  light: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", RAY_PATH],
  auto: ["M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4", RAY_PATH],
  dark: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
};

/**
 * Lucide `sun`, `sun-moon` or `moon` for a stop.
 * @param props Component props.
 * @param props.stop The stop to draw.
 * @returns The decorative SVG.
 */
function StopIcon({ stop }: { stop: ThemePreference }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {STOP_PATHS[stop].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

/**
 * The sun at the foot of the brightness bar. It turns with the level and its
 * rays fade with it, through the `--strength` custom property.
 * @returns The decorative SVG.
 */
function BarSun() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className="theme-sun pointer-events-none absolute size-6.5"
    >
      <circle cx="12" cy="12" r="4" />
      <path className="theme-sun-rays" d={RAY_PATH} />
    </svg>
  );
}

/**
 * The orientation the tile's media query chose, read from the control's
 * flex direction: a row puts the tabs beside a vertical bar, a column stacks a
 * horizontal bar under the tabs.
 * @param flexDirection The computed `flex-direction` of the control.
 * @returns `vertical` for a row, `horizontal` otherwise.
 */
export function orientationFromFlexDirection(flexDirection: string): ThemeOrientation {
  return flexDirection.startsWith("row") ? "vertical" : "horizontal";
}

/**
 * Follows the visible orientation of the control as its media query flips.
 * Starts horizontal, the layout the pre-hydration CSS renders.
 * @param controlRef The element whose flex direction carries the orientation.
 * @returns The current orientation.
 */
function useOrientation(controlRef: RefObject<HTMLElement | null>): ThemeOrientation {
  const [orientation, setOrientation] = useState<ThemeOrientation>("horizontal");
  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    const read = (): void => {
      setOrientation(orientationFromFlexDirection(getComputedStyle(control).flexDirection));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(control);
    return () => {
      observer.disconnect();
    };
  }, [controlRef]);
  return orientation;
}

/**
 * Stores a stop picked with the bar or the keys and plays the theme sound when
 * it differs from the current one. The tabs name their sound in markup.
 * @param stop The picked stop, if any.
 * @param current The stop in force before the pick.
 * @param engine The sound engine to play through.
 * @param apply Stores the stop; defaults to the theme store.
 */
export function chooseWithSound(
  stop: ThemePreference | undefined,
  current: ThemePreference,
  engine: Pick<SoundEngine, "play"> = soundEngine,
  apply: (stop: ThemePreference) => void = chooseTheme,
): void {
  if (!stop) return;
  apply(stop);
  if (stop !== current) engine.play("theme");
}

/**
 * Theme control: sliding tabs for Light, Auto and Dark with a brightness bar.
 * Below `lg` the tabs sit in one row over a horizontal bar; from `lg` up they
 * are a column beside a vertical bar. The bar is one `slider`; arrow keys step between the stops
 * and a press or drag on it picks the nearest one. A press replayed after
 * hydration is untrusted: it picks a stop but starts no drag. A real drag only
 * moves the fill, through `--drag-level`, and the stop is stored on release.
 * Tabs and bar always agree because both read and write the same stored
 * preference.
 * @param props Component props.
 * @param props.copy Localised labels.
 * @returns The control.
 */
export default function ThemeSlider({ copy }: { copy: ThemeToggleCopy }) {
  const preference = useThemePreference();
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    isHydratedOnClient,
    isHydratedOnServer,
  );
  const barRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const orientation = useOrientation(controlRef);
  const axisPosition = (event: PointerEvent<HTMLDivElement>): number =>
    orientation === "horizontal" ? event.clientX : event.clientY;
  const [dragging, setDragging] = useState(false);
  const replayedPressRef = useRef(false);
  const dragLevelRef = useRef(0);
  const index = THEME_STOPS.indexOf(preference);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = stopAfterKey(index, event.key);
    if (next === undefined) return;
    event.preventDefault();
    chooseWithSound(THEME_STOPS[next], preference);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isTrusted) {
      event.currentTarget.setPointerCapture(event.pointerId);
      followPointer(barRef.current, axisPosition(event), dragLevelRef, undefined, orientation);
      setDragging(true);
    } else {
      replayedPressRef.current = true;
      chooseWithSound(pickAtPointer(barRef.current, axisPosition(event), orientation), preference);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragging) {
      followPointer(barRef.current, axisPosition(event), dragLevelRef, undefined, orientation);
    } else if (replayedPressRef.current && event.buttons === 1) {
      chooseWithSound(pickAtPointer(barRef.current, axisPosition(event), orientation), preference);
    }
  };

  const endDrag = (): void => {
    replayedPressRef.current = false;
    if (!dragging) return;
    setDragging(false);
    chooseWithSound(releaseDrag(barRef.current, dragLevelRef.current), preference);
  };

  const cancelDrag = (): void => {
    replayedPressRef.current = false;
    if (!dragging) return;
    setDragging(false);
    releaseDrag(barRef.current, dragLevelRef.current);
  };

  return (
    <div ref={controlRef} className="theme-control">
      <div
        role="group"
        aria-label={copy.label}
        data-theme-tabs
        data-ready={isHydrated ? "" : undefined}
        className="theme-tabs relative bg-muted"
      >
        <span
          aria-hidden="true"
          data-theme-indicator
          className="theme-indicator absolute bg-foreground"
          data-ready={isHydrated ? "" : undefined}
          data-stop={preference}
        />
        {THEME_STOPS.map((stop) => (
          <button
            key={stop}
            type="button"
            data-tab={stop}
            data-sound="theme"
            aria-pressed={stop === preference}
            onClick={() => {
              chooseTheme(stop);
            }}
            className={cn(
              "theme-tab relative z-10 flex items-center justify-center text-center font-mono font-bold",
              stop === preference ? "text-background" : "text-muted-foreground",
            )}
          >
            <span className="theme-tab-icon shrink-0">
              <StopIcon stop={stop} />
            </span>
            {copy[stop]}
          </button>
        ))}
      </div>
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label={copy.label}
        aria-orientation={orientation}
        aria-valuemin={0}
        aria-valuemax={THEME_STOPS.length - 1}
        aria-valuenow={index}
        aria-valuetext={copy[preference]}
        data-theme-slider
        data-ready={isHydrated ? "" : undefined}
        data-dragging={dragging}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        className="theme-bar relative overflow-hidden bg-muted"
        data-stop={preference}
      >
        <span aria-hidden="true" className="theme-fill absolute inset-0 bg-foreground" />
        <BarSun />
      </div>
    </div>
  );
}
