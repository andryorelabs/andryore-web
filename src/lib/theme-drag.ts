import type { ThemePreference } from "./theme";
import {
  levelFromRatio,
  squeezeForLevel,
  stopFromLevel,
  stopFromRatio,
  THEME_STOPS,
} from "./theme-stops";

/**
 * The way the brightness bar runs: vertically or from left to right.
 */
export type ThemeOrientation = "vertical" | "horizontal";

/**
 * The box of the brightness bar that a pointer position is measured in.
 */
interface BarBox {
  top: number;
  height: number;
  left?: number;
  width?: number;
}

/**
 * The part of the brightness bar the drag reads and writes: its box and the
 * custom properties that carry the live level.
 * @public
 */
export interface DragBar {
  getBoundingClientRect: () => BarBox;
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">;
}

const browserMatchMedia = (query: string): { matches: boolean } | undefined =>
  typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query) : undefined;

/**
 * Whether the visitor asked the system to reduce motion.
 * @param match Answers a media query; defaults to the browser's `matchMedia`.
 * @returns True when `prefers-reduced-motion: reduce` matches.
 */
export function isReducedMotionPreferred(match = browserMatchMedia): boolean {
  return match("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * Where a pointer sits in the bar as a ratio from the light end, or
 * `undefined` while the bar has no box to measure in. Vertical bars have the
 * light end at the top; horizontal ones at the right.
 * @param bar The bar, if mounted.
 * @param position The pointer's position along the bar's axis in the viewport:
 * `clientY` when vertical, `clientX` when horizontal.
 * @param orientation The way the bar runs.
 * @returns The ratio, `0` at the light end and `1` at the dark end.
 */
function ratioAt(
  bar: DragBar | null,
  position: number,
  orientation: ThemeOrientation,
): number | undefined {
  const box = bar?.getBoundingClientRect();
  if (!box) return undefined;
  if (orientation === "horizontal") {
    const { left = 0, width = 0 } = box;
    return width === 0 ? undefined : 1 - (position - left) / width;
  }
  return box.height === 0 ? undefined : (position - box.top) / box.height;
}

/**
 * Writes the live level under the pointer to the bar's custom properties, so
 * the fill and the sun follow it without a render. Stays inside 0 to 100 under
 * reduced motion; otherwise it rubber-bands past both ends.
 * @param bar The bar, if mounted.
 * @param position The pointer's position along the bar's axis in the viewport.
 * @param level Receives the level that was written.
 * @param level.current The last written level.
 * @param isReducedMotion Whether to clamp instead of rubber-band.
 * @param orientation The way the bar runs.
 */
export function followPointer(
  bar: DragBar | null,
  position: number,
  level: { current: number },
  isReducedMotion: boolean = isReducedMotionPreferred(),
  orientation: ThemeOrientation = "vertical",
): void {
  const ratio = ratioAt(bar, position, orientation);
  if (!bar || ratio === undefined) return;
  const banded = levelFromRatio(ratio);
  const next = isReducedMotion ? Math.min(100, Math.max(0, banded)) : banded;
  level.current = next;
  bar.style.setProperty("--drag-level", String(next));
  bar.style.setProperty("--drag-squeeze", String(squeezeForLevel(next)));
}

/**
 * Ends a drag: removes the live level so the stored stop takes over again.
 * @param bar The bar, if mounted.
 * @param level The last level written while dragging.
 * @returns The stop nearest to that level.
 */
export function releaseDrag(bar: DragBar | null, level: number): ThemePreference | undefined {
  bar?.style.removeProperty("--drag-level");
  bar?.style.removeProperty("--drag-squeeze");
  return THEME_STOPS[stopFromLevel(level)];
}

/**
 * The stop under a pointer, for a press that starts no drag.
 * @param bar The bar, if mounted.
 * @param position The pointer's position along the bar's axis in the viewport.
 * @param orientation The way the bar runs.
 * @returns The stop in that third of the bar, if the bar can be measured.
 */
export function pickAtPointer(
  bar: DragBar | null,
  position: number,
  orientation: ThemeOrientation = "vertical",
): ThemePreference | undefined {
  const ratio = ratioAt(bar, position, orientation);
  return ratio === undefined ? undefined : THEME_STOPS[stopFromRatio(ratio)];
}
