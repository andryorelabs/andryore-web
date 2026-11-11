import { describe, expect, test } from "bun:test";

import { watchHeaderSurface } from "./header-surface";
import type { VisibilityEntry, VisibilityObserverFactory } from "./in-view";

const createHeader = () => {
  const attributes = new Set<string>();
  return {
    attributes,
    toggleAttribute: (name: string, shouldForce?: boolean) => {
      if (shouldForce) attributes.add(name);
      else attributes.delete(name);
      return attributes.has(name);
    },
  };
};

const createFake = () => {
  const state: {
    callback: ((entries: VisibilityEntry[]) => void) | undefined;
  } = { callback: undefined };
  const factory: VisibilityObserverFactory = (callback) => {
    state.callback = callback;
    return {
      observe: () => state.callback,
      unobserve: () => state.callback,
      disconnect: () => state.callback,
    };
  };
  return { state, factory };
};

describe("watchHeaderSurface", () => {
  test("sets data-scrolled when the sentinel leaves the viewport", () => {
    const header = createHeader();
    const sentinel = {};
    const { state, factory } = createFake();
    watchHeaderSurface(header, sentinel, factory);
    state.callback?.([{ target: sentinel, isIntersecting: false }]);
    expect(header.attributes.has("data-scrolled")).toBe(true);
    state.callback?.([{ target: sentinel, isIntersecting: true }]);
    expect(header.attributes.has("data-scrolled")).toBe(false);
  });

  test("stays transparent without an observer", () => {
    const header = createHeader();
    watchHeaderSurface(header, {}, undefined);
    expect(header.attributes.has("data-scrolled")).toBe(false);
  });
});
