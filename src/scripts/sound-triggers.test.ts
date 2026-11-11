import { describe, expect, test } from "bun:test";

import type { SoundEvent } from "../lib/sound-engine";
import {
  createSoundTriggers,
  isControlEntry,
  resolveClickSound,
  type TriggerElement,
  type TriggerEvent,
  type TriggerRoot,
} from "./sound-triggers";

interface FakeOptions {
  sound?: string;
  disabled?: boolean;
  interactive?: boolean;
}

const control = (options: FakeOptions = {}) => {
  const element: TriggerElement = {
    getAttribute: (name) => (name === "data-sound" ? (options.sound ?? null) : null),
    matches: (selector) => selector === ":disabled" && !!options.disabled,
    contains: (other) => other === inner,
  };
  const inner = { inside: true };
  const target = {
    closest: (selector: string) =>
      selector.includes("data-sound") || options.interactive !== false ? element : null,
  };
  return { target, inner };
};

const createHarness = () => {
  type Listener = (event: TriggerEvent) => void;
  const played: SoundEvent[] = [];
  let loaded = 0;
  const listeners = new Map<string, Listener>();
  const root: TriggerRoot = {
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
  };
  const triggers = createSoundTriggers({
    play: (event) => {
      played.push(event);
    },
    loadAvailability: () => {
      loaded += 1;
      return Promise.resolve();
    },
  });
  triggers.mount(root);
  return {
    played,
    triggers,
    loaded: () => loaded,
    fire: (type: string, event: TriggerEvent) => {
      listeners.get(type)?.(event);
    },
  };
};

describe("resolveClickSound", () => {
  test("plays click for a plain control", () => {
    expect(resolveClickSound(control().target)).toBe("click");
  });

  test("plays the event a control names", () => {
    for (const name of ["theme", "copy", "cv", "switch", "pop"] as const) {
      expect(resolveClickSound(control({ sound: name }).target)).toBe(name);
    }
  });

  test("falls back to click for an unknown name and stays silent for none", () => {
    expect(resolveClickSound(control({ sound: "bogus" }).target)).toBe("click");
    expect(resolveClickSound(control({ sound: "none" }).target)).toBeUndefined();
  });

  test("ignores disabled controls, non-controls and non-elements", () => {
    expect(resolveClickSound(control({ disabled: true }).target)).toBeUndefined();
    expect(resolveClickSound({ closest: () => null })).toBeUndefined();
    expect(resolveClickSound(null)).toBeUndefined();
  });
});

describe("isControlEntry", () => {
  test("is true for a mouse arriving from outside", () => {
    const { target } = control();
    expect(isControlEntry({ target, pointerType: "mouse" })).toBe(true);
  });

  test("is false for touch, for moves inside, and off-control", () => {
    const { target, inner } = control();
    expect(isControlEntry({ target, pointerType: "touch" })).toBe(false);
    expect(isControlEntry({ target, relatedTarget: inner })).toBe(false);
    expect(isControlEntry({ target: control({ interactive: false }).target })).toBe(false);
  });

  test("is false for a control that opts out", () => {
    expect(isControlEntry({ target: control({ sound: "none" }).target })).toBe(false);
  });
});

describe("createSoundTriggers", () => {
  test("loads availability once on mount", () => {
    expect(createHarness().loaded()).toBe(1);
  });

  test("plays one event per click", () => {
    const harness = createHarness();
    harness.fire("click", { target: control({ sound: "copy" }).target });
    expect(harness.played).toEqual(["copy"]);
  });

  test("stays silent on hover before any gesture", () => {
    const harness = createHarness();
    harness.fire("pointerover", {
      target: control().target,
      pointerType: "mouse",
    });
    expect(harness.played).toEqual([]);
  });

  test("plays hover on a pointer entering a control", () => {
    const harness = createHarness();
    harness.fire("pointerdown", { target: control().target });
    harness.fire("pointerover", {
      target: control().target,
      pointerType: "mouse",
    });
    harness.fire("pointerover", {
      target: control().target,
      pointerType: "touch",
    });
    expect(harness.played).toEqual(["hover"]);
  });

  test("stays silent for the unlocked events until a gesture", () => {
    const harness = createHarness();
    harness.triggers.playUnlocked("live");
    expect(harness.played).toEqual([]);
    expect(harness.triggers.isUnlocked()).toBe(false);
    harness.fire("pointerdown", { target: null });
    expect(harness.triggers.isUnlocked()).toBe(true);
    harness.triggers.playUnlocked("live");
    expect(harness.played).toEqual(["live"]);
  });
});
