import { describe, expect, test } from "bun:test";

import {
  DELETE_DELAY_MS,
  nextPhraseStep,
  PHRASE_HOLD_MS,
  PHRASE_PAUSE_MS,
  PHRASE_TYPE_MAX_MS,
  PHRASE_TYPE_MIN_MS,
  startPhraseTyping,
  type PhraseState,
} from "./typing-headline";

function noop(): void {
  return;
}

describe("nextPhraseStep", () => {
  const phrases = ["ab", "c"];
  const start: PhraseState = { index: 0, length: 0, mode: "typing" };

  test("types with a per-letter delay between the minimum and the maximum", () => {
    const low = nextPhraseStep(start, phrases, () => 0);
    const high = nextPhraseStep(start, phrases, () => 0.999);
    expect(low.state.length).toBe(1);
    expect(low.delay).toBe(PHRASE_TYPE_MIN_MS);
    expect(high.delay).toBeLessThanOrEqual(PHRASE_TYPE_MAX_MS);
    expect(high.delay).toBeGreaterThan(PHRASE_TYPE_MIN_MS);
  });

  test("holds a full phrase, deletes it, pauses, then moves to the next one", () => {
    const full = nextPhraseStep({ ...start, length: 1 }, phrases, () => 0);
    expect(full.state).toEqual({ index: 0, length: 2, mode: "deleting" });
    expect(full.delay).toBe(PHRASE_HOLD_MS);
    const deleting = nextPhraseStep(full.state, phrases, () => 0);
    expect(deleting.state.length).toBe(1);
    expect(deleting.delay).toBe(DELETE_DELAY_MS);
    const empty = nextPhraseStep(deleting.state, phrases, () => 0);
    expect(empty.state).toEqual({ index: 1, length: 0, mode: "typing" });
    expect(empty.delay).toBe(PHRASE_PAUSE_MS);
  });

  test("wraps to the first phrase after the last one", () => {
    const empty = nextPhraseStep({ index: 1, length: 1, mode: "deleting" }, phrases, () => 0);
    expect(empty.state.index).toBe(0);
  });
});

const options = (isReducedMotion: boolean, queue: (() => void)[]) => ({
  reducedMotion: isReducedMotion,
  random: () => 0,
  schedule: (callback: () => void) => {
    queue.push(callback);
    return queue.length;
  },
  cancel: noop,
});

describe("startPhraseTyping", () => {
  test("shows the first phrase and schedules nothing under reduced motion", () => {
    const target = { textContent: "" };
    const queue: (() => void)[] = [];
    startPhraseTyping(target, ["one.", "two."], options(true, queue));
    expect(target.textContent).toBe("one.");
    expect(queue).toHaveLength(0);
  });

  test("types the first phrase, then rotates to the second", () => {
    const target = { textContent: "one." };
    const queue: (() => void)[] = [];
    startPhraseTyping(target, ["ab", "c"], options(false, queue));
    expect(target.textContent).toBe("");
    const seen: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      queue.shift()?.();
      seen.push(target.textContent);
    }
    expect(seen).toEqual(["a", "ab", "a", "", "c", ""]);
  });
});
