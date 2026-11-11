const SPRITE_CLASSES: Readonly<Record<number, string>> = {
  48: "sprite-48",
  61: "sprite-61",
};

/**
 * Class that plays a vertical sprite strip with `steps()`. The CSP forbids
 * inline styles, so each supported frame count has a literal class (the
 * stylesheet holds its keyframe timing) that the Tailwind scanner can see.
 * @param frames Number of frames stacked in the strip.
 * @returns The class, or `undefined` for a still image or an unknown length.
 */
export function spriteClass(frames: number): string | undefined {
  return SPRITE_CLASSES[frames];
}
