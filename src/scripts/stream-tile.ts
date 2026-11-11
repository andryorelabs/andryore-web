import { formatNextStream, nextSession, selectStreamView, weekColumn } from "../lib/stream-state";
import type { StreamStatus } from "../lib/twitch-status";

/**
The same-origin path of the Live status endpoint (ADR 0004).
 */
export const STATUS_ENDPOINT = "/api/stream-status";

type Fetcher = (url: string) => Promise<Response>;

/**
The parts of an element the script writes, so tests can fake them.
 */
export interface StreamTileElement {
  hidden: boolean;
  textContent?: string | null;
  dataset?: Record<string, string | undefined>;
}

/**
The parts of the tile root the script touches, so tests can fake them.
 */
export interface StreamTileRoot {
  dataset: Record<string, string | undefined>;
  querySelector: (selector: string) => StreamTileElement | null;
}

/**
Milliseconds between countdown refreshes.
 */
export const COUNTDOWN_INTERVAL_MS = 30_000;

const UNAVAILABLE: StreamStatus = { state: "unavailable" };

const isStreamStatus = (value: unknown): value is StreamStatus => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { state?: unknown; title?: unknown };
  return candidate.state === "live"
    ? typeof candidate.title === "string"
    : candidate.state === "offline" || candidate.state === "unavailable";
};

/**
 * Asks the same-origin endpoint for the Live status.
 * @param fetcher The `fetch` to use; defaults to the platform one.
 * @returns The status, or unavailable when the request or payload fails.
 */
export async function loadStreamStatus(
  fetcher: Fetcher = (url) => fetch(url, { credentials: "omit" }),
): Promise<StreamStatus> {
  try {
    const response = await fetcher(STATUS_ENDPOINT);
    if (!response.ok) return UNAVAILABLE;
    const body: unknown = await response.json();
    return isStreamStatus(body) ? body : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Writes the next session and its compact countdown into the tile as one value.
 * @param root The tile element.
 * @param now The current moment.
 */
export function refreshCountdown(root: StreamTileRoot, now: Date): void {
  const locale = root.dataset.locale ?? "en";
  const start = nextSession(now);
  const next = root.querySelector("[data-stream-next]");
  if (!next) return;
  next.textContent = formatNextStream(start, now, locale, {
    prefix: root.dataset.cdIn ?? "",
    day: root.dataset.cdDay ?? "d",
    hour: root.dataset.cdHour ?? "h",
    minute: root.dataset.cdMinute ?? "min",
  });
}

const DAY_SELECTORS: readonly string[] = [
  '[data-stream-day="0"]',
  '[data-stream-day="1"]',
  '[data-stream-day="2"]',
  '[data-stream-day="3"]',
  '[data-stream-day="4"]',
  '[data-stream-day="5"]',
  '[data-stream-day="6"]',
];

/**
 * Outlines today's column of the week row.
 * @param root The tile element.
 * @param now The current moment.
 */
function markToday(root: StreamTileRoot, now: Date): void {
  const selector = DAY_SELECTORS[weekColumn(now)];
  const day = selector ? root.querySelector(selector) : undefined;
  if (day?.dataset) day.dataset.today = "true";
}

/**
 * Picks the view from the live answer and the `data-started` flag and sets it
 * on the tile; CSS shows the matching parts. Without JavaScript the
 * server-rendered coming-soon slate stays.
 * @param root The tile element holding the state-specific parts.
 * @param fetcher The `fetch` to use; defaults to the platform one.
 * @param now The current moment, injectable for tests.
 * @param onLive Called once when the answer is that the stream is live.
 * @returns Resolves once the tile shows the answer.
 */
export async function mountStreamTile(
  root: StreamTileRoot,
  fetcher?: Fetcher,
  now: Date = new Date(),
  onLive?: () => void,
): Promise<void> {
  const status = await loadStreamStatus(fetcher);
  const view = selectStreamView(status, root.dataset.started === "true");
  root.dataset.state = view;
  markToday(root, now);
  if (status.state === "live") {
    const title = root.querySelector("[data-stream-title]");
    if (title && status.title) title.textContent = status.title;
    onLive?.();
  }
  if (view === "scheduled") refreshCountdown(root, now);
}
