import {
  soundEngine,
  type PlayOptions,
  type SoundEngine,
  type SoundEvent,
} from "../lib/sound-engine";

/**
The attribute that names the event an element plays, or `none`.
 */
const SOUND_ATTRIBUTE = "data-sound";

const INTERACTIVE_SELECTOR =
  'a[href], button, summary, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="switch"]';
const CLICK_SELECTOR = `${INTERACTIVE_SELECTOR}, [${SOUND_ATTRIBUTE}]`;

const NAMED_EVENTS: Readonly<Record<SoundEvent, true>> = {
  hover: true,
  click: true,
  switch: true,
  theme: true,
  copy: true,
  cv: true,
  live: true,
  pop: true,
  stackTick: true,
  stackSettle: true,
};

/**
The parts of an element the triggers read, so tests can fake it.
 */
export interface TriggerElement {
  getAttribute: (name: string) => string | null;
  matches: (selector: string) => boolean;
  contains: (other: unknown) => boolean;
}

/**
The parts of a node that may sit inside a trigger.
 */
interface TriggerTarget {
  closest: (selector: string) => TriggerElement | null;
}

/**
The parts of a pointer or click event the triggers read.
 */
export interface TriggerEvent {
  target: unknown;
  relatedTarget?: unknown;
  pointerType?: string;
}

/**
The parts of the document the triggers listen on.
 */
export interface TriggerRoot {
  addEventListener: (
    type: "click" | "pointerover" | "pointerdown" | "keydown",
    listener: (event: TriggerEvent) => void,
  ) => void;
}

/**
The slice of the engine the triggers use.
 */
export type TriggerEngine = Pick<SoundEngine, "play" | "loadAvailability">;

const isTarget = (value: unknown): value is TriggerTarget =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { closest?: unknown }).closest === "function";

const isNamedEvent = (value: string | null): value is SoundEvent =>
  value !== null && Object.hasOwn(NAMED_EVENTS, value);

const isDisabled = (element: TriggerElement): boolean =>
  element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";

/**
 * Finds the sound a click on a target should make.
 * @param target The event target.
 * @returns The named event, `click` for a plain control, or undefined for none.
 */
export function resolveClickSound(target: unknown): SoundEvent | undefined {
  if (!isTarget(target)) return undefined;
  const element = target.closest(CLICK_SELECTOR);
  if (!element || isDisabled(element)) return undefined;
  const named = element.getAttribute(SOUND_ATTRIBUTE);
  if (named === "none") return undefined;
  return isNamedEvent(named) ? named : "click";
}

/**
 * Checks whether a pointer arrived on a control from outside it, so moves
 * between the children of one control do not repeat the tick.
 * @param event The pointer event.
 * @returns True when the hover tick should play.
 */
export function isControlEntry(event: TriggerEvent): boolean {
  if (event.pointerType === "touch" || !isTarget(event.target)) return false;
  const element = event.target.closest(INTERACTIVE_SELECTOR);
  if (!element || isDisabled(element) || element.getAttribute(SOUND_ATTRIBUTE) === "none")
    return false;
  const origin = event.relatedTarget;
  return !origin || !element.contains(origin);
}

/**
What the page script holds: mount once, play after a gesture.
 */
export interface SoundTriggers {
  mount: (root: TriggerRoot) => void;
  playUnlocked: (event: SoundEvent, options?: PlayOptions) => void;
  isUnlocked: () => boolean;
}

/**
 * Builds the delegated sound triggers. Clicks and hovers on controls play,
 * nothing plays on scroll, and `playUnlocked` stays silent until the visitor
 * has pressed or tapped something.
 * @param engine The sound engine to play through.
 * @returns The page-level triggers.
 */
export function createSoundTriggers(engine: TriggerEngine): SoundTriggers {
  let isAudioUnlocked = false;
  const unlock = (): void => {
    isAudioUnlocked = true;
  };
  return {
    mount: (root) => {
      void engine.loadAvailability();
      root.addEventListener("pointerdown", unlock);
      root.addEventListener("keydown", unlock);
      root.addEventListener("click", (event) => {
        unlock();
        const sound = resolveClickSound(event.target);
        if (sound) engine.play(sound);
      });
      root.addEventListener("pointerover", (event) => {
        if (isAudioUnlocked && isControlEntry(event)) engine.play("hover");
      });
    },
    playUnlocked: (event, options) => {
      if (isAudioUnlocked) engine.play(event, options);
    },
    isUnlocked: () => isAudioUnlocked,
  };
}

/**
 * The triggers of the page, wired to the sound engine.
 * @public
 */
export const soundTriggers: SoundTriggers = createSoundTriggers(soundEngine);
