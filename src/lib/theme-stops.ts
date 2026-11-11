import type { ThemePreference } from "./theme";

/**
 * The slider stops from top to bottom, brightest first.
 */
export const THEME_STOPS: readonly ThemePreference[] = ["light", "auto", "dark"];

const STOP_LEVELS: Readonly<Record<ThemePreference, number>> = {
  light: 100,
  auto: 62,
  dark: 24,
};

/**
 * Finds the brightness level a stop fills the bar to.
 * @param stop The theme stop to read.
 * @returns A percentage: Dark 24, Auto 62, Light 100.
 */
export function stopLevel(stop: ThemePreference): number {
  return STOP_LEVELS[stop];
}

/**
 * Finds the 0 to 1 strength of a stop, which turns the sun and lights its rays.
 * @param stop The theme stop to read.
 * @returns The level as a fraction.
 */
export function stopStrength(stop: ThemePreference): number {
  return STOP_LEVELS[stop] / 100;
}

/**
 * Moves a stop index by a key press. Down and left go towards Dark, up and
 * right towards Light, as on the canvas brightness bar.
 * @param index The current stop index.
 * @param key The pressed key.
 * @returns The new index, or undefined when the key does not move the slider.
 */
export function stopAfterKey(index: number, key: string): number | undefined {
  const last = THEME_STOPS.length - 1;
  if (key === "ArrowDown" || key === "ArrowLeft") {
    return Math.min(last, index + 1);
  }
  if (key === "ArrowUp" || key === "ArrowRight") return Math.max(0, index - 1);
  if (key === "Home") return 0;
  return key === "End" ? last : undefined;
}

/**
 * Finds the stop under a press on the track.
 * @param ratio Vertical position on the track, 0 at the top and 1 at the
 * bottom.
 * @returns The index of the stop whose third of the track holds the press.
 */
export function stopFromRatio(ratio: number): number {
  return Math.min(THEME_STOPS.length - 1, Math.max(0, Math.floor(ratio * THEME_STOPS.length)));
}

const OVERSHOOT_CAP = 8;
const OVERSHOOT_DAMPING = 0.35;
const FULL_SQUEEZE = 0.96;

/**
 * Damps a drag past an end of the bar: it starts at 0.35 of the pull and
 * flattens towards the cap, so the bar never stretches more than about 8%.
 * @param overshoot The pull past the end, in percent; the sign is kept.
 * @returns The damped overshoot, strictly between minus and plus the cap.
 */
export function rubberBand(overshoot: number): number {
  return OVERSHOOT_CAP * Math.tanh((overshoot * OVERSHOOT_DAMPING) / OVERSHOOT_CAP);
}

/**
 * Turns a pointer position into the fill level that follows it one to one,
 * rubber-banded past either end.
 * @param ratio Vertical position on the bar, 0 at the top and 1 at the bottom.
 * @returns A percentage, 100 at the top and 0 at the bottom, within about 8
 * of either end when the pointer leaves the bar.
 */
export function levelFromRatio(ratio: number): number {
  const level = (1 - ratio) * 100;
  if (level > 100) return 100 + rubberBand(level - 100);
  return level < 0 ? rubberBand(level) : level;
}

/**
 * Finds the stop a released drag settles on.
 * @param level The fill level at release, in percent.
 * @returns The index of the stop whose level is nearest.
 */
export function stopFromLevel(level: number): number {
  let nearest = 0;
  for (const [index, stop] of THEME_STOPS.entries()) {
    const best = THEME_STOPS[nearest] ?? "light";
    if (Math.abs(level - STOP_LEVELS[stop]) < Math.abs(level - STOP_LEVELS[best])) {
      nearest = index;
    }
  }
  return nearest;
}

/**
 * Finds how much the bar narrows while it is pulled past an end.
 * @param level The fill level, in percent.
 * @returns 1 inside the bar, down to 0.96 at the full overshoot.
 */
export function squeezeForLevel(level: number): number {
  let overshoot = 0;
  if (level > 100) overshoot = level - 100;
  else if (level < 0) overshoot = -level;
  return 1 - (1 - FULL_SQUEEZE) * Math.min(1, overshoot / OVERSHOOT_CAP);
}
