import { formatClock, greetingPeriod, type GreetingPeriod } from "../lib/clock";

/**
How often the clock tile refreshes, in milliseconds.
 */
export const CLOCK_INTERVAL_MS = 30_000;

interface TextTarget {
  textContent: string | null;
}

export interface ClockParts {
  greeting?: TextTarget;
  local: TextTarget;
  utc: TextTarget;
  greetings?: Readonly<Record<GreetingPeriod, string>>;
}

export interface ClockOptions {
  now: () => Date;
  timeZone?: string;
  setInterval: (handler: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
}

const localHour = (instant: Date, timeZone?: string): number =>
  Number(formatClock(instant, timeZone).slice(0, 2));

/**
 * Writes both times, and the greeting when the parts carry one for one instant.
 * @param parts The text nodes to fill and the greetings by period.
 * @param instant The moment to show.
 * @param timeZone An IANA zone; omit for the browser's own.
 */
export function renderClock(parts: ClockParts, instant: Date, timeZone?: string): void {
  if (parts.greeting && parts.greetings) {
    parts.greeting.textContent = parts.greetings[greetingPeriod(localHour(instant, timeZone))];
  }
  parts.local.textContent = formatClock(instant, timeZone);
  parts.utc.textContent = formatClock(instant, "UTC");
}

/**
 * Renders the clock now and then every {@link CLOCK_INTERVAL_MS}.
 * @param parts The text nodes to fill and the greetings by period.
 * @param options Clock and timer, injectable for tests.
 * @returns A function that stops the updates.
 */
export function startClock(parts: ClockParts, options: ClockOptions): () => void {
  const tick = (): void => {
    renderClock(parts, options.now(), options.timeZone);
  };
  tick();
  const id = options.setInterval(tick, CLOCK_INTERVAL_MS);
  return () => {
    options.clearInterval(id);
  };
}
