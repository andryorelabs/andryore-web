import { describe, expect, test } from "bun:test";

import { writeFx, type FxStorage } from "../lib/fx-store";
import { mountDockSoundState } from "./dock-state";

const storageWith = (value: string | null): FxStorage => {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key, next) => {
      stored = next;
    },
  };
};

const fakeElement = () => {
  const attributes: Record<string, string> = {};
  return {
    attributes,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
  };
};

describe("mountDockSoundState", () => {
  test("paints aria-checked true from a stored on choice", () => {
    const element = fakeElement();
    mountDockSoundState(element, storageWith("on"));
    expect(element.attributes["aria-checked"]).toBe("true");
  });

  test("paints aria-checked false with nothing stored", () => {
    const element = fakeElement();
    mountDockSoundState(element, storageWith(null));
    expect(element.attributes["aria-checked"]).toBe("false");
  });

  test("repaints after a toggle", () => {
    const element = fakeElement();
    const storage = storageWith("off");
    mountDockSoundState(element, storage);
    writeFx(storage, true);
    expect(element.attributes["aria-checked"]).toBe("true");
  });

  test("does nothing without a dock", () => {
    expect(() => {
      mountDockSoundState(null, storageWith("on"));
    }).not.toThrow();
  });
});
