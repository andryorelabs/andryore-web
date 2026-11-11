import { afterEach, describe, expect, test } from "bun:test";

import {
  mountStackSound,
  mountStackSoundInBrowser,
  type StackSoundDependencies,
  type StackSoundScene,
} from "./stack-sound";

const VIEWPORT = 800;
const HEIGHT = 2000;
const SPAN = HEIGHT + VIEWPORT * 0.4;

function topFor(progress: number): number {
  return VIEWPORT - progress * SPAN;
}

function createHarness(overrides: Partial<StackSoundDependencies> = {}) {
  const played: { event: string; rate?: number | undefined }[] = [];
  const frames: (() => void)[] = [];
  const state = { top: topFor(0), now: 0, near: undefined as unknown };
  let scrollListener: (() => void) | undefined;
  let observerCallback: ((isNear: boolean) => void) | undefined;
  let isDisconnected = false;
  let listenerOptionsRemoved = 0;
  const scene: StackSoundScene = {
    getBoundingClientRect: () => ({ top: state.top, height: HEIGHT }),
  };
  const dependencies: StackSoundDependencies = {
    isSoundOn: () => true,
    isUnlocked: () => true,
    isHidden: () => false,
    isMotionReduced: () => false,
    supportsScrollTimeline: () => true,
    isCompact: () => false,
    viewportHeight: () => VIEWPORT,
    now: () => state.now,
    play: (event, options) => {
      played.push({ event, rate: options?.rate });
    },
    requestFrame: (callback) => {
      frames.push(callback);
    },
    addScrollListener: (listener) => {
      scrollListener = listener;
    },
    removeScrollListener: () => {
      scrollListener = undefined;
      listenerOptionsRemoved += 1;
    },
    createObserver: (onChange) => {
      observerCallback = onChange;
      return {
        observe: () => {
          state.near = true;
        },
        disconnect: () => {
          isDisconnected = true;
        },
      };
    },
    ...overrides,
  };
  const stop = mountStackSound(scene, dependencies);
  const scrollTo = (progress: number): void => {
    state.top = topFor(progress);
    state.now += 100;
    scrollListener?.();
    for (const frame of frames.splice(0)) {
      frame();
    }
  };
  return {
    played,
    frames,
    stop,
    scrollTo,
    nearViewport: (isNear: boolean) => observerCallback?.(isNear),
    isListening: () => scrollListener !== undefined,
    fireScroll: () => scrollListener?.(),
    wasDisconnected: () => isDisconnected,
    removals: () => listenerOptionsRemoved,
    state,
  };
}

function mounted(overrides: Partial<StackSoundDependencies> = {}) {
  const harness = createHarness(overrides);
  harness.nearViewport(true);
  return harness;
}

describe("mountStackSound", () => {
  test("attaches the scroll listener only while the scene is near", () => {
    const harness = createHarness();
    expect(harness.isListening()).toBe(false);
    harness.nearViewport(true);
    expect(harness.isListening()).toBe(true);
    harness.nearViewport(false);
    expect(harness.isListening()).toBe(false);
    harness.nearViewport(false);
    expect(harness.removals()).toBe(1);
  });

  test("coalesces scroll events into one frame", () => {
    const harness = mounted();
    harness.fireScroll();
    harness.fireScroll();
    harness.fireScroll();
    expect(harness.frames).toHaveLength(1);
  });

  test("ticks in both scroll directions", () => {
    const harness = mounted();
    harness.scrollTo(0.1);
    harness.scrollTo(0.2);
    harness.scrollTo(0.1);
    const ticks = harness.played.filter((entry) => entry.event === "stackTick");
    expect(ticks).toHaveLength(3);
    const [first, second, third] = ticks;
    expect(second?.rate).toBeGreaterThan(first?.rate ?? 0);
    expect(third?.rate).toBeLessThan(second?.rate ?? 0);
  });

  test("uses 12 tiles on a compact screen", () => {
    const wide = mounted();
    wide.scrollTo(0.1);
    const compact = mounted({ isCompact: () => true });
    compact.scrollTo(0.1);
    expect(compact.played[0]?.rate).toBeLessThan(wide.played[0]?.rate ?? 0);
    expect(wide.played[0]?.rate).toBeCloseTo(0.9 + (0.5 * 3) / 24);
    expect(compact.played[0]?.rate).toBeCloseTo(0.9 + (0.5 * 1) / 12);
  });

  test("pops once per forward pass", () => {
    const harness = mounted();
    harness.scrollTo(0.5);
    harness.scrollTo(0.75);
    harness.scrollTo(0.9);
    harness.scrollTo(0.8);
    const settles = harness.played.filter((entry) => entry.event === "stackSettle");
    expect(settles).toHaveLength(1);
    harness.scrollTo(0.5);
    harness.scrollTo(0.75);
    expect(harness.played.filter((entry) => entry.event === "stackSettle")).toHaveLength(2);
  });

  test("a jump past the settle point plays only the pop, never a tick before it", () => {
    const harness = mounted();
    harness.scrollTo(0.5);
    const before = harness.played.length;
    harness.scrollTo(0.8);
    expect(harness.played.slice(before).map((entry) => entry.event)).toEqual(["stackSettle"]);
  });

  const gates: [string, Partial<StackSoundDependencies>][] = [
    ["sound is off", { isSoundOn: () => false }],
    ["the audio is locked", { isUnlocked: () => false }],
    ["the tab is hidden", { isHidden: () => true }],
    ["motion is reduced", { isMotionReduced: () => true }],
  ];
  for (const [name, override] of gates) {
    test(`plays nothing when ${name}`, () => {
      const harness = mounted(override);
      harness.scrollTo(0.1);
      harness.scrollTo(0.5);
      harness.scrollTo(0.8);
      expect(harness.played).toEqual([]);
    });
  }

  test("plays nothing and never listens without scroll timelines", () => {
    const harness = createHarness({ supportsScrollTimeline: () => false });
    harness.nearViewport(true);
    harness.scrollTo(0.5);
    harness.scrollTo(0.8);
    expect(harness.played).toEqual([]);
    expect(harness.isListening()).toBe(false);
  });

  test("does not pop for a gate that opens after the scene settled", () => {
    let isSoundOn = false;
    const harness = mounted({ isSoundOn: () => isSoundOn });
    harness.scrollTo(0.5);
    harness.scrollTo(0.8);
    isSoundOn = true;
    harness.scrollTo(0.85);
    expect(harness.played.filter((entry) => entry.event === "stackSettle")).toEqual([]);
  });

  test("stops listening and observing when stopped", () => {
    const harness = mounted();
    harness.stop();
    expect(harness.wasDisconnected()).toBe(true);
    expect(harness.isListening()).toBe(false);
  });
});

describe("mountStackSoundInBrowser", () => {
  const restorers: (() => void)[] = [];

  const stubGlobal = (name: string, value: unknown): void => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
    restorers.push(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  };

  afterEach(() => {
    for (const restore of restorers.splice(0)) restore();
  });

  test("wires the browser APIs and stops cleanly", () => {
    const listeners: string[] = [];
    const frames: FrameRequestCallback[] = [];
    const observed: unknown[] = [];
    let observerCallback: IntersectionObserverCallback | undefined;
    stubGlobal("document", { hidden: false });
    stubGlobal("matchMedia", () => ({ matches: false }));
    stubGlobal("CSS", { supports: () => true });
    stubGlobal("innerHeight", VIEWPORT);
    stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    stubGlobal("addEventListener", (type: string) => {
      listeners.push(`add:${type}`);
    });
    stubGlobal("removeEventListener", (type: string) => {
      listeners.push(`remove:${type}`);
    });
    stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe(target: unknown): void {
          observed.push(target);
        }
        disconnect(): void {
          observed.push("disconnected");
        }
      },
    );
    stubGlobal("HTMLElement", EventTarget);
    class FakeScene extends HTMLElement {
      override getBoundingClientRect(): DOMRect {
        return { top: topFor(0.5), height: HEIGHT } as DOMRect;
      }
    }
    const scene = new FakeScene();

    const stop = mountStackSoundInBrowser(scene);
    expect(observed).toEqual([scene]);

    observerCallback?.(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(listeners).toEqual(["add:scroll"]);

    observerCallback?.(
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(listeners).toEqual(["add:scroll", "remove:scroll"]);

    stop();
    expect(observed).toEqual([scene, "disconnected"]);
  });
});
