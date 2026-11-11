import type { ClientDirective } from "astro";

/**
Events that count as the first interaction with an island.
 */
export const INTERACTION_EVENTS = ["pointerover", "pointerdown", "focusin", "touchstart"] as const;

/**
The fields of a `pointerdown` needed to replay it after hydration.
 */
export interface PointerDownRecord {
  target: EventTarget | null;
  init: PointerEventInit;
}

type Hydrate = () => Promise<void>;

const isClickable = (
  target: EventTarget | null | undefined,
): target is EventTarget & { click: () => void; isConnected: boolean } =>
  target !== null &&
  target !== undefined &&
  "click" in target &&
  typeof target.click === "function" &&
  "isConnected" in target;

const isDispatcher = (
  target: EventTarget | null,
): target is EventTarget & { isConnected: boolean } => target !== null && "isConnected" in target;

const recordPointerDown = (event: Event): PointerDownRecord => {
  const pointer = event as PointerEvent;
  return {
    target: event.target,
    init: {
      bubbles: true,
      cancelable: true,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType,
      isPrimary: pointer.isPrimary,
      button: pointer.button,
      buttons: pointer.buttons,
    },
  };
};

/**
 * Dispatches a recorded `pointerdown` again, so a press that landed before
 * hydration reaches the handlers React attached since. The replay is
 * untrusted, which lets a handler tell it from a live press.
 * @param record The press recorded before hydration finished.
 */
export function replayPointerDown(record: PointerDownRecord): void {
  const { target, init } = record;
  if (isDispatcher(target) && target.isConnected) {
    target.dispatchEvent(new PointerEvent("pointerdown", init));
  }
}

/**
 * Hydrates an island on its first pointer, focus or touch interaction and
 * replays the press and click that landed while hydration was still running.
 * @param root The island's root element.
 * @param load Resolves the hydration function, as Astro passes to a directive.
 * @returns Resolves once the island is hydrated and any early press and click replayed.
 */
export async function hydrateOnInteraction(
  root: EventTarget,
  load: () => Promise<Hydrate>,
): Promise<void> {
  const earlyClick: { target: EventTarget | undefined } = {
    target: undefined,
  };
  const recordClick = (event: Event): void => {
    earlyClick.target = event.target ?? undefined;
  };
  const earlyPress: { record: PointerDownRecord | undefined } = {
    record: undefined,
  };
  const recordPress = (event: Event): void => {
    earlyPress.record ??= recordPointerDown(event);
  };

  await new Promise<void>((resolve) => {
    const start = (): void => {
      for (const eventName of INTERACTION_EVENTS) {
        root.removeEventListener(eventName, start);
      }
      resolve();
    };
    for (const eventName of INTERACTION_EVENTS) {
      root.addEventListener(eventName, start, { passive: true, once: true });
    }
    root.addEventListener("click", recordClick, { capture: true });
    root.addEventListener("pointerdown", recordPress, { capture: true });
  });

  const hydrate = await load();
  await hydrate();
  root.removeEventListener("click", recordClick, { capture: true });
  root.removeEventListener("pointerdown", recordPress, { capture: true });

  if (earlyPress.record) replayPointerDown(earlyPress.record);

  const { target } = earlyClick;
  if (isClickable(target) && target.isConnected) {
    target.click();
  }
}

async function hydrateAndReport(element: EventTarget, load: () => Promise<Hydrate>): Promise<void> {
  try {
    await hydrateOnInteraction(element, load);
  } catch (error) {
    console.error("client:interaction failed to hydrate", error);
  }
}

const hydrateOnInteractionDirective: ClientDirective = (load, _options, element) => {
  void hydrateAndReport(element, load);
};

export default hydrateOnInteractionDirective;
