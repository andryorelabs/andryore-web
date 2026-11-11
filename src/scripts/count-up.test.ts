import { describe, expect, test } from "bun:test";

import { COUNT_UP_DURATION_MS, startCountUp } from "./count-up";

function createFrames() {
  let pending: ((timestamp: number) => void) | undefined;
  return {
    request: (callback: (timestamp: number) => void) => {
      pending = callback;
      return 1;
    },
    advance: (timestamp: number) => {
      const callback = pending;
      pending = undefined;
      callback?.(timestamp);
    },
    isIdle: () => pending === undefined,
  };
}

describe("startCountUp", () => {
  test("animates from 0 to the total in 900 ms with a cubic ease-out, once", () => {
    const target = { textContent: "1,234" };
    const frames = createFrames();
    startCountUp(target, 1234, {
      reducedMotion: false,
      locale: "en",
      requestFrame: frames.request,
    });
    expect(target.textContent).toBe("0");
    frames.advance(1000);
    frames.advance(1000 + COUNT_UP_DURATION_MS / 2);
    const midway = Number(target.textContent.replace(",", ""));
    expect(midway).toBeGreaterThan(617);
    expect(midway).toBeLessThan(1234);
    expect(midway).toBe(1080);
    frames.advance(1000 + COUNT_UP_DURATION_MS);
    expect(target.textContent).toBe("1,234");
    expect(frames.isIdle()).toBe(true);
  });

  test("is 900 ms", () => {
    expect(COUNT_UP_DURATION_MS).toBe(900);
  });

  test("stays static under reduced motion", () => {
    const target = { textContent: "stale" };
    const frames = createFrames();
    startCountUp(target, 1234, {
      reducedMotion: true,
      locale: "es",
      requestFrame: frames.request,
    });
    expect(target.textContent).toBe("1.234");
    expect(frames.isIdle()).toBe(true);
  });

  test("skips the animation for an empty total", () => {
    const target = { textContent: "x" };
    const frames = createFrames();
    startCountUp(target, 0, {
      reducedMotion: false,
      locale: "en",
      requestFrame: frames.request,
    });
    expect(target.textContent).toBe("0");
    expect(frames.isIdle()).toBe(true);
  });
});
