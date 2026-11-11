import type { StreamStatus } from "./twitch-status";

/**
 * The four things the stream tile can show.
 */
export type StreamView = "coming-soon" | "scheduled" | "live" | "unavailable";

/**
 * UTC weekdays of the planned sessions: Tuesday and Thursday.
 */
export const SESSION_WEEKDAYS: readonly number[] = [2, 4];

/**
 * UTC hour at which every planned session starts.
 */
const SESSION_HOUR_UTC = 19;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Picks the view from the endpoint answer and the content flag. A live
 * channel always shows live; before streams have started, anything else is
 * the coming-soon slate.
 * @param status The answer of the status endpoint.
 * @param haveStreamsStarted The content flag set once streams are running.
 * @returns The view to show.
 */
export function selectStreamView(status: StreamStatus, haveStreamsStarted: boolean): StreamView {
  if (status.state === "live") return "live";
  if (!haveStreamsStarted) return "coming-soon";
  return status.state === "offline" ? "scheduled" : "unavailable";
}

/**
 * Finds the next planned session start strictly after a moment.
 * @param now The current moment.
 * @returns The start of the next Tuesday or Thursday session, in UTC.
 */
export function nextSession(now: Date): Date {
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now.getTime() + offset * DAY_MS);
    if (!SESSION_WEEKDAYS.includes(day.getUTCDay())) continue;
    const start = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      SESSION_HOUR_UTC,
    );
    if (start > now.getTime()) return new Date(start);
  }
  throw new Error("No session found within a week");
}

/**
 * Formats a session start as short weekday and UTC time, such as
 * "Tue 19:00 UTC".
 * @param start Moment the session begins.
 * @param locale Language of the weekday.
 * @returns The label.
 */
export function formatSession(start: Date, locale: string): string {
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(start);
  const hour = String(start.getUTCHours()).padStart(2, "0");
  const minute = String(start.getUTCMinutes()).padStart(2, "0");
  return `${weekday} ${hour}:${minute} UTC`;
}

/**
 * Describes the time left until a start, such as "in 2 days".
 * @param start The future moment.
 * @param now The current moment.
 * @param locale Language of the phrase.
 * @returns The countdown phrase.
 */
export function formatCountdown(start: Date, now: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const remaining = Math.max(0, start.getTime() - now.getTime());
  const calendarDays = Math.round(
    (Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
      DAY_MS,
  );
  if (remaining >= DAY_MS) {
    return formatter.format(calendarDays, "day");
  }
  return remaining >= HOUR_MS
    ? formatter.format(Math.floor(remaining / HOUR_MS), "hour")
    : formatter.format(Math.ceil(remaining / MINUTE_MS), "minute");
}

/**
 * Unit words and lead word of the compact countdown, from the content file.
 */
export interface CountdownUnits {
  prefix: string;
  day: string;
  hour: string;
  minute: string;
}

/**
 * Describes the time left until a start in the compact tile form, such as
 * "in 2 d 3 h". Under a day it shows hours and minutes, under an hour only
 * minutes, and it never goes below zero.
 * @param start The future moment.
 * @param now The current moment.
 * @param units Lead word and unit words in the page language.
 * @returns The countdown phrase.
 */
export function formatCompactCountdown(start: Date, now: Date, units: CountdownUnits): string {
  const remaining = Math.max(0, start.getTime() - now.getTime());
  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  if (days >= 1) {
    return `${units.prefix} ${String(days)} ${units.day} ${String(hours)} ${units.hour}`;
  }
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  return hours >= 1
    ? `${units.prefix} ${String(hours)} ${units.hour} ${String(minutes)} ${units.minute}`
    : `${units.prefix} ${String(minutes)} ${units.minute}`;
}

/**
 * Finds the Monday-first column of a moment's UTC weekday.
 * @param now The moment to place.
 * @returns 0 for Monday up to 6 for Sunday.
 */
export function weekColumn(now: Date): number {
  return (now.getUTCDay() + 6) % 7;
}

/**
 * One column of the week row.
 */
export interface WeekDay {
  /**
   * True for a planned session day.
   */
  session: boolean;
  /**
   * True for the current UTC day.
   */
  today: boolean;
}

/**
 * Builds the Monday-to-Sunday row of the stream tile.
 * @param now The current moment.
 * @returns Seven days, Monday first.
 */
export function weekStrip(now: Date): WeekDay[] {
  const todayColumn = weekColumn(now);
  return Array.from({ length: 7 }, (_, column) => ({
    session: SESSION_WEEKDAYS.includes((column + 1) % 7),
    today: column === todayColumn,
  }));
}

/**
 * Formats the next-stream value of the tile as one string, such as
 * "Tue 19:00 UTC · in 2 d 3 h".
 * @param start Moment the next session begins.
 * @param now The current moment.
 * @param locale Language of the weekday.
 * @param units Lead word and unit words of the countdown.
 * @returns The label with the capitalized short weekday.
 */
export function formatNextStream(
  start: Date,
  now: Date,
  locale: string,
  units: CountdownUnits,
): string {
  const session = formatSession(start, locale);
  const label = session.charAt(0).toUpperCase() + session.slice(1);
  return `${label} · ${formatCompactCountdown(start, now, units)}`;
}
