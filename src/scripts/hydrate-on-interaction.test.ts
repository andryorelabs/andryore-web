import { describe, expect, test } from "bun:test";

import { hydrateOnInteraction, INTERACTION_EVENTS } from "./hydrate-on-interaction";

interface ClickableTarget extends EventTarget {
  clicks: number;
  click: () => void;
  isConnected: boolean;
}

function createRoot(): ClickableTarget {
  const root = new EventTarget() as ClickableTarget;
  root.clicks = 0;
  root.isConnected = true;
  root.click = () => {
    root.clicks += 1;
  };
  return root;
}

function createLoader() {
  const { promise: gate, resolve: release } = Promise.withResolvers<undefined>();
  const state = { loads: 0, hydrations: 0, release };
  const load = () => {
    state.loads += 1;
    return Promise.resolve(async () => {
      await gate;
      state.hydrations += 1;
    });
  };
  return { state, load };
}

class FakePointerEvent extends Event {
  clientY: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.clientY = init.clientY ?? 0;
  }
}

Object.defineProperty(globalThis, "PointerEvent", {
  value: FakePointerEvent,
  configurable: true,
});

function pressOn(target: EventTarget, clientY: number): Event {
  const press = new Event("pointerdown") as Event & { clientY: number };
  press.clientY = clientY;
  Object.defineProperty(press, "target", { value: target });
  return press;
}

describe("hydrateOnInteraction", () => {
  test("replays a press that arrived before hydration finished", async () => {
    const root = createRoot();
    const { state, load } = createLoader();
    const done = hydrateOnInteraction(root, load);
    const target = createRoot();
    const replayed: { type: string; clientY: number; trusted: boolean }[] = [];
    target.addEventListener("pointerdown", (event) => {
      replayed.push({
        type: event.type,
        clientY: (event as FakePointerEvent).clientY,
        trusted: event.isTrusted,
      });
    });
    root.dispatchEvent(pressOn(target, 42));
    state.release();
    await done;
    expect(replayed).toEqual([{ type: "pointerdown", clientY: 42, trusted: false }]);
  });

  test("does not replay a press onto a detached target", async () => {
    const root = createRoot();
    const { state, load } = createLoader();
    const done = hydrateOnInteraction(root, load);
    const target = createRoot();
    target.isConnected = false;
    let replays = 0;
    target.addEventListener("pointerdown", () => {
      replays += 1;
    });
    root.dispatchEvent(pressOn(target, 1));
    state.release();
    await done;
    expect(replays).toBe(0);
  });

  test("waits for an interaction before loading", () => {
    const root = createRoot();
    const { state, load } = createLoader();
    void hydrateOnInteraction(root, load);
    expect(state.loads).toBe(0);
  });

  for (const eventName of INTERACTION_EVENTS) {
    test(`hydrates once on the first ${eventName}`, async () => {
      const root = createRoot();
      const { state, load } = createLoader();
      const done = hydrateOnInteraction(root, load);
      root.dispatchEvent(new Event(eventName));
      root.dispatchEvent(new Event(eventName));
      state.release();
      await done;
      expect(state.loads).toBe(1);
      expect(state.hydrations).toBe(1);
    });
  }

  test("replays a click that arrived before hydration finished", async () => {
    const root = createRoot();
    const { state, load } = createLoader();
    const done = hydrateOnInteraction(root, load);
    root.dispatchEvent(new Event("pointerdown"));
    const target = createRoot();
    const click = new Event("click");
    Object.defineProperty(click, "target", { value: target });
    root.dispatchEvent(click);
    state.release();
    await done;
    expect(target.clicks).toBe(1);
  });

  test("does not replay without an early click", async () => {
    const root = createRoot();
    const { state, load } = createLoader();
    const done = hydrateOnInteraction(root, load);
    root.dispatchEvent(new Event("focusin"));
    state.release();
    await done;
    expect(root.clicks).toBe(0);
  });

  test("does not replay onto a detached target", async () => {
    const root = createRoot();
    const { state, load } = createLoader();
    const done = hydrateOnInteraction(root, load);
    root.dispatchEvent(new Event("pointerdown"));
    const target = createRoot();
    target.isConnected = false;
    const click = new Event("click");
    Object.defineProperty(click, "target", { value: target });
    root.dispatchEvent(click);
    state.release();
    await done;
    expect(target.clicks).toBe(0);
  });
});
