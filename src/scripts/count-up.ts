/**
Length of the one-time counter animation, in milliseconds.
 */
export const COUNT_UP_DURATION_MS = 900;

interface TextTarget {
  textContent: string | null;
}

export interface CountUpOptions {
  reducedMotion: boolean;
  locale: string;
  requestFrame: (callback: (timestamp: number) => void) => number;
}

const easeOut = (progress: number): number => 1 - (1 - progress) ** 3;

/**
 * Counts a number up from 0 once. Under reduced motion, or for an empty
 * total, it writes the final value and runs no frame. The markup already
 * holds the final value, so without JavaScript nothing changes.
 * @param target The text node that shows the number.
 * @param total The final value.
 * @param options Motion preference, locale and frame scheduler.
 */
export function startCountUp(target: TextTarget, total: number, options: CountUpOptions): void {
  const format = new Intl.NumberFormat(options.locale, {
    useGrouping: "always",
  });
  if (options.reducedMotion || total <= 0) {
    target.textContent = format.format(Math.max(0, total));
    return;
  }
  let startedAt: number | undefined;
  const step = (timestamp: number): void => {
    startedAt ??= timestamp;
    const progress = Math.min(1, (timestamp - startedAt) / COUNT_UP_DURATION_MS);
    target.textContent = format.format(Math.round(total * easeOut(progress)));
    if (progress < 1) options.requestFrame(step);
  };
  target.textContent = format.format(0);
  options.requestFrame(step);
}
