export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

/**
 * Time-of-day bucket of a local hour.
 * @param hour Hour of the day, 0 to 23.
 * @returns The period the greeting is chosen from.
 */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return hour >= 18 && hour < 22 ? "evening" : "night";
}

/**
 * Formats an instant as 24-hour `HH:MM`, the same in every language.
 * @param instant The moment to show.
 * @param timeZone An IANA zone, or `UTC`; omit for the browser's zone.
 * @returns The zero-padded time.
 */
export function formatClock(instant: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(instant);
}
