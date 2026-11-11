import { describe, expect, test } from "bun:test";

import type { FxStorage } from "../lib/fx-store";
import { mountFxAvailability, mountFxSwitch, type FxSwitchElement } from "./fx-tile";

const noop = (): undefined => undefined;

const createSwitch = () => {
  const attributes = new Map<string, string>();
  let click: () => void = noop;
  const element: FxSwitchElement = {
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    addEventListener: (_type, listener) => {
      click = listener;
    },
  };
  return {
    element,
    attributes,
    press: () => {
      click();
    },
  };
};

const createStorage = (): FxStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("mountFxSwitch", () => {
  test("starts off and toggles with persistence", () => {
    const { element, attributes, press } = createSwitch();
    const storage = createStorage();
    mountFxSwitch(element, storage);
    expect(attributes.get("aria-checked")).toBe("false");
    press();
    expect(attributes.get("aria-checked")).toBe("true");
    expect(storage.values.get("ao-fx2")).toBe("on");
    press();
    expect(attributes.get("aria-checked")).toBe("false");
  });

  test("restores the stored choice", () => {
    const storage = createStorage();
    storage.setItem("ao-fx2", "on");
    const { element, attributes } = createSwitch();
    mountFxSwitch(element, storage);
    expect(attributes.get("aria-checked")).toBe("true");
  });
});

const createSource = () => {
  let current: "unknown" | "available" | "unavailable" = "unknown";
  let notify: () => void = noop;
  return {
    source: {
      getAvailability: () => current,
      subscribeAvailability: (onChange: () => void) => {
        notify = onChange;
        return noop;
      },
    },
    settle: (next: "available" | "unavailable") => {
      current = next;
      notify();
    },
  };
};

const createTile = () => {
  const flags = new Map<string, boolean>();
  return {
    flags,
    element: {
      toggleAttribute: (name: string, shouldForce: boolean) => {
        flags.set(name, shouldForce);
        return shouldForce;
      },
    },
  };
};

describe("mountFxAvailability", () => {
  test("keeps the tile while availability is unknown or available", () => {
    const { source, settle } = createSource();
    const { element, flags } = createTile();
    mountFxAvailability(element, source);
    expect(flags.get("data-sound-unavailable")).toBe(false);
    settle("available");
    expect(flags.get("data-sound-unavailable")).toBe(false);
  });

  test("hides the tile once the audio files are known to be missing", () => {
    const { source, settle } = createSource();
    const { element, flags } = createTile();
    mountFxAvailability(element, source);
    settle("unavailable");
    expect(flags.get("data-sound-unavailable")).toBe(true);
  });
});
