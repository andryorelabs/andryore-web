/**
 * Delay between consecutive items of a staggered reveal, in milliseconds.
 */
export const REVEAL_STAGGER_MS = 60;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const toStep = (index: number): number => Math.max(0, Math.floor(index));

/**
 * Delay before the item at `index` starts its reveal.
 * @param index Position of the item in the reveal sequence.
 * @returns The delay in milliseconds.
 */
export function revealDelay(index: number): number {
  return toStep(index) * REVEAL_STAGGER_MS;
}

const REVEAL_CLASSES = [
  "reveal-0",
  "reveal-1",
  "reveal-2",
  "reveal-3",
  "reveal-4",
  "reveal-5",
  "reveal-6",
  "reveal-7",
  "reveal-8",
  "reveal-9",
  "reveal-10",
  "reveal-11",
] as const;

/**
 * Class that sets the `.reveal` animation's stagger delay. The CSP forbids
 * inline styles, so the delay is a class and not a custom property; indexes
 * past the last class share its delay.
 * @param index Position of the item in the reveal sequence.
 * @returns A literal `reveal-N` class the Tailwind scanner can see.
 */
export function revealClass(index: number): (typeof REVEAL_CLASSES)[number] {
  const last = REVEAL_CLASSES.length - 1;
  return REVEAL_CLASSES[Math.min(toStep(index), last)] ?? "reveal-0";
}

/**
 * Reports whether the visitor asked the system for reduced motion. The
 * stylesheet already switches every animation off; scripts that animate must
 * check this first.
 * @param win Anything with a `matchMedia`, defaults to no preference.
 * @returns True when reduced motion is requested.
 */
export function isMotionReduced(
  win?: Readonly<{ matchMedia: (query: string) => { matches: boolean } }>,
): boolean {
  return win?.matchMedia(REDUCED_MOTION_QUERY).matches ?? false;
}
