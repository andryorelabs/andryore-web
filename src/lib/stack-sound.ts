/**
 * Scene progress at which the tiles have finished converging.
 */
const CONVERGE_END = 0.64;

/**
 * Scene progress at which the closing card has faded in and the pop plays.
 */
const SETTLE_AT = 0.72;

/**
 * Scene progress below which the settle pop arms again.
 */
const SETTLE_REARM_BELOW = 0.6;

/**
 * The lowest tick playback rate, at the first tile.
 */
const TICK_RATE_MIN = 0.9;

/**
 * The highest tick playback rate, at the last tile.
 */
const TICK_RATE_MAX = 1.4;

/**
 * The shortest time between two ticks, in milliseconds.
 */
const TICK_GAP_MS = 45;

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Maps the scene box to the progress of its view timeline over
 * `entry 0% exit 40%`: 0 when the top edge reaches the viewport bottom, 1 once
 * the bottom edge is 40% of a viewport above the viewport top.
 * @param rect The top and height of the scene, as `getBoundingClientRect`.
 * @param viewportHeight The viewport height in pixels.
 * @returns A progress clamped to 0 to 1.
 */
export function sceneProgress(
  rect: Readonly<{ top: number; height: number }>,
  viewportHeight: number,
): number {
  const span = rect.height + viewportHeight * 0.4;
  return span <= 0 ? 0 : clampUnit((viewportHeight - rect.top) / span);
}

/**
 * Maps scene progress to how many tiles have converged.
 * @param progress Scene progress, 0 to 1.
 * @param tileCount The number of visible tiles.
 * @returns An index from 0 to `tileCount`.
 */
export function tickIndex(progress: number, tileCount: number): number {
  const converged = clampUnit(progress / CONVERGE_END);
  return Math.min(tileCount, Math.floor(converged * tileCount));
}

/**
 * Maps a tick index to its playback rate, rising linearly.
 * @param index A tick index.
 * @param tileCount The number of visible tiles.
 * @returns A rate from 0.9 to 1.4.
 */
export function tickRate(index: number, tileCount: number): number {
  if (tileCount <= 0) return TICK_RATE_MIN;
  const fraction = clampUnit(index / tileCount);
  return TICK_RATE_MIN + (TICK_RATE_MAX - TICK_RATE_MIN) * fraction;
}

/**
 * What the scene asks to play for one progress update.
 */
export interface StackSoundCue {
  tickRate?: number;
  settle?: true;
}

/**
 * The stateful mapper from progress updates to sound cues.
 */
export interface StackSoundMapper {
  update: (progress: number, tileCount: number, nowMs: number) => StackSoundCue;
}

/**
 * Builds the mapper. The first update only sets the baseline, so loading
 * halfway down the scene is silent. Ticks fire on each index change in either
 * direction and are dropped, never queued, inside the throttle gap. The settle
 * cue fires once per forward pass and arms again below the hysteresis point.
 * @returns A mapper holding the last index and the settle state.
 */
export function createStackSoundMapper(): StackSoundMapper {
  let lastIndex: number | undefined;
  let lastCount = 0;
  let lastTickAt = -Infinity;
  let isArmed = true;
  return {
    update: (progress, tileCount, nowMs) => {
      const index = tickIndex(progress, tileCount);
      const cue: StackSoundCue = {};
      if (lastIndex === undefined || tileCount !== lastCount) {
        isArmed = progress < SETTLE_AT;
      } else {
        if (index !== lastIndex && nowMs - lastTickAt >= TICK_GAP_MS) {
          lastTickAt = nowMs;
          cue.tickRate = tickRate(index, tileCount);
        }
        if (isArmed && progress >= SETTLE_AT) {
          isArmed = false;
          cue.settle = true;
        } else if (!isArmed && progress < SETTLE_REARM_BELOW) {
          isArmed = true;
        }
      }
      lastIndex = index;
      lastCount = tileCount;
      return cue;
    },
  };
}
