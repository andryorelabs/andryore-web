import { describe, expect, test } from "bun:test";

import { observeVisibility, type VisibilityEntry, type VisibilityObserverFactory } from "./in-view";

const createFake = () => {
  const state: {
    callback: ((entries: VisibilityEntry[]) => void) | undefined;
    observed: object[];
    unobserved: object[];
  } = { callback: undefined, observed: [], unobserved: [] };
  const factory: VisibilityObserverFactory = (callback) => {
    state.callback = callback;
    return {
      observe: (target) => {
        state.observed.push(target);
      },
      unobserve: (target) => {
        state.unobserved.push(target);
      },
      disconnect: () => {
        state.observed.length = 0;
      },
    };
  };
  return { state, factory };
};

describe("observeVisibility", () => {
  test("reports each change of visibility of an observed target", () => {
    const { state, factory } = createFake();
    const target = {};
    const seen: boolean[] = [];
    observeVisibility(
      [target],
      (_target, visible) => {
        seen.push(visible);
      },
      {
        createObserver: factory,
      },
    );
    expect(state.observed).toEqual([target]);
    state.callback?.([{ target, isIntersecting: true }]);
    state.callback?.([{ target, isIntersecting: false }]);
    expect(seen).toEqual([true, false]);
  });

  test("once stops watching after the first visible report", () => {
    const { state, factory } = createFake();
    const target = {};
    const seen: boolean[] = [];
    observeVisibility(
      [target],
      (_target, visible) => {
        seen.push(visible);
      },
      {
        createObserver: factory,
        once: true,
      },
    );
    state.callback?.([{ target, isIntersecting: false }]);
    expect(seen).toEqual([]);
    state.callback?.([{ target, isIntersecting: true }]);
    expect(seen).toEqual([true]);
    expect(state.unobserved).toEqual([target]);
  });

  test("treats every target as visible when there is no observer", () => {
    const seen: boolean[] = [];
    observeVisibility(
      [{}, {}],
      (_target, visible) => {
        seen.push(visible);
      },
      {
        createObserver: undefined,
        once: true,
      },
    );
    expect(seen).toEqual([true, true]);
  });
});
