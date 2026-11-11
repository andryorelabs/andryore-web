/**
Delay between two deleted characters, in milliseconds.
 */
export const DELETE_DELAY_MS = 28;

/**
What the typing loop needs from the browser, injected for tests.
 */
interface TypingOptions<Handle> {
  reducedMotion: boolean;
  schedule: (callback: () => void, delay: number) => Handle;
  cancel: (handle: Handle) => void;
}

interface TextTarget {
  textContent: string | null;
}

function stopNothing(): void {
  return;
}

/**
Shortest delay between two typed letters of a rotating phrase, in milliseconds.
 */
export const PHRASE_TYPE_MIN_MS = 55;

/**
Longest delay between two typed letters of a rotating phrase, in milliseconds.
 */
export const PHRASE_TYPE_MAX_MS = 105;

/**
How long a finished rotating phrase stays on screen, in milliseconds.
 */
export const PHRASE_HOLD_MS = 1700;

/**
How long the empty line waits before the next phrase, in milliseconds.
 */
export const PHRASE_PAUSE_MS = 380;

/**
Where the rotating loop is: phrase, visible characters and direction.
 */
export interface PhraseState {
  index: number;
  length: number;
  mode: "typing" | "deleting";
}

/**
 * Advances the rotating type, hold, delete, pause loop by one character.
 * Typing uses a random delay per letter; deleting is steady and fast.
 * @param state The current phrase, visible length and direction.
 * @param phrases The phrases to rotate through.
 * @param random Source of a number in [0, 1), injected for tests.
 * @returns The new state and the delay before the next step.
 */
export function nextPhraseStep(
  state: PhraseState,
  phrases: readonly string[],
  random: () => number,
): { state: PhraseState; delay: number } {
  const total = phrases[state.index]?.length ?? 0;
  if (state.mode === "typing") {
    const length = Math.min(total, state.length + 1);
    if (length >= total) {
      return {
        state: { index: state.index, length, mode: "deleting" },
        delay: PHRASE_HOLD_MS,
      };
    }
    const span = PHRASE_TYPE_MAX_MS - PHRASE_TYPE_MIN_MS;
    return {
      state: { index: state.index, length, mode: "typing" },
      delay: PHRASE_TYPE_MIN_MS + Math.floor(random() * span),
    };
  }
  const length = Math.max(0, state.length - 1);
  if (length <= 0) {
    return {
      state: {
        index: (state.index + 1) % phrases.length,
        length: 0,
        mode: "typing",
      },
      delay: PHRASE_PAUSE_MS,
    };
  }
  return {
    state: { index: state.index, length, mode: "deleting" },
    delay: DELETE_DELAY_MS,
  };
}

/**
What the rotating loop needs from the browser, injected for tests.
 */
export interface PhraseTypingOptions<Handle> extends TypingOptions<Handle> {
  random: () => number;
}

/**
 * Types each phrase in turn, holds it, deletes it and moves to the next one.
 * Under reduced motion it writes the first phrase once and schedules nothing.
 * @param target The element that shows the typed text.
 * @param phrases The phrases to rotate through.
 * @param options Motion preference, random source and timer functions.
 * @returns A function that stops the loop.
 */
export function startPhraseTyping<Handle>(
  target: TextTarget,
  phrases: readonly string[],
  options: PhraseTypingOptions<Handle>,
): () => void {
  const first = phrases[0];
  if (first === undefined) return stopNothing;
  if (options.reducedMotion || phrases.length === 0) {
    target.textContent = first;
    return stopNothing;
  }
  let state: PhraseState = { index: 0, length: 0, mode: "typing" };
  let handle: Handle | undefined;
  const tick = (): void => {
    const step = nextPhraseStep(state, phrases, options.random);
    state = step.state;
    target.textContent = (phrases[state.index] ?? "").slice(0, state.length);
    handle = options.schedule(tick, step.delay);
  };
  target.textContent = "";
  handle = options.schedule(tick, PHRASE_TYPE_MIN_MS);
  return () => {
    if (handle !== undefined) options.cancel(handle);
  };
}
