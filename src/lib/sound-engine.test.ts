import { beforeEach, describe, expect, test } from "bun:test";

import {
  createSoundEngine,
  isSoundManifest,
  SOUND_FILES,
  type SoundEngineDependencies,
} from "./sound-engine";

interface FakeSource {
  buffer: unknown;
  playbackRate: { value: number };
  connect: (target: unknown) => void;
  start: () => void;
  started: boolean;
}

interface FakeGain {
  gain: { value: number };
  connect: (target: unknown) => void;
}

const noop = (): void => {
  return;
};

const MANIFEST = { sounds: [...SOUND_FILES] };

function createFakeContext() {
  const sources: FakeSource[] = [];
  const gains: FakeGain[] = [];
  const compressors: {
    threshold: { value: number };
    ratio: { value: number };
    connect: (target: unknown) => void;
  }[] = [];
  const context = {
    state: "suspended" as "suspended" | "running",
    destination: { name: "destination" },
    resumeCalls: 0,
    decoded: [] as number[],
    resume() {
      context.resumeCalls += 1;
      context.state = "running";
      return Promise.resolve();
    },
    createGain() {
      const node: FakeGain = { gain: { value: 1 }, connect: noop };
      gains.push(node);
      return node;
    },
    createDynamicsCompressor() {
      const node = {
        threshold: { value: 0 },
        ratio: { value: 0 },
        connect: noop,
      };
      compressors.push(node);
      return node;
    },
    createBufferSource() {
      const node: FakeSource = {
        buffer: undefined,
        playbackRate: { value: 1 },
        connect: noop,
        start: () => {
          node.started = true;
        },
        started: false,
      };
      sources.push(node);
      return node;
    },
    decodeAudioData(data: ArrayBuffer) {
      context.decoded.push(data.byteLength);
      return Promise.resolve({ decoded: data.byteLength });
    },
  };
  return { context, sources, gains, compressors };
}

function setup(
  overrides: Partial<SoundEngineDependencies> = {},
  manifest: unknown = MANIFEST,
  isMissing = false,
) {
  const fake = createFakeContext();
  const requested: string[] = [];
  const clock = { now: 1000 };
  let contextsCreated = 0;
  const dependencies: SoundEngineDependencies = {
    createContext: () => {
      contextsCreated += 1;
      return fake.context as unknown as AudioContext;
    },
    fetch: (input) => {
      requested.push(input);
      if (input.endsWith("manifest.json"))
        return Promise.resolve(
          isMissing ? new Response("nope", { status: 404 }) : Response.json(manifest),
        );
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4])));
    },
    now: () => clock.now,
    isHidden: () => false,
    isEnabled: () => true,
    supportsHover: () => true,
    ...overrides,
  };
  const engine = createSoundEngine(dependencies);
  return {
    engine,
    fake,
    requested,
    clock,
    contexts: () => contextsCreated,
  };
}

async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

describe("isSoundManifest", () => {
  test("accepts a manifest listing every sound", () => {
    expect(isSoundManifest(MANIFEST)).toBe(true);
  });

  test("rejects malformed manifests", () => {
    expect(isSoundManifest(null)).toBe(false);
    expect(isSoundManifest({})).toBe(false);
    expect(isSoundManifest({ sounds: "click" })).toBe(false);
    expect(isSoundManifest({ sounds: ["click"] })).toBe(false);
  });
});

describe("availability", () => {
  let state: ReturnType<typeof setup>;
  beforeEach(() => {
    state = setup();
  });

  test("is unknown and unavailable until the manifest loads", () => {
    expect(state.engine.getAvailability()).toBe("unknown");
    expect(state.engine.isAvailable()).toBe(false);
  });

  test("becomes available for a valid manifest, fetched once", async () => {
    await state.engine.loadAvailability();
    await state.engine.loadAvailability();
    expect(state.engine.isAvailable()).toBe(true);
    expect(state.requested).toEqual(["/sounds/manifest.json"]);
  });

  test("notifies subscribers when it becomes known", async () => {
    let calls = 0;
    const unsubscribe = state.engine.subscribeAvailability(() => {
      calls += 1;
    });
    await state.engine.loadAvailability();
    expect(calls).toBe(1);
    unsubscribe();
  });

  test("is unavailable when the manifest is missing", async () => {
    const missing = setup({}, undefined, true);
    await missing.engine.loadAvailability();
    expect(missing.engine.getAvailability()).toBe("unavailable");
    expect(missing.engine.isAvailable()).toBe(false);
  });

  test("is unavailable when the manifest is malformed", async () => {
    const malformed = setup({}, { sounds: ["click"] });
    await malformed.engine.loadAvailability();
    expect(malformed.engine.isAvailable()).toBe(false);
  });

  test("is unavailable when the request throws", async () => {
    const broken = setup({
      fetch: () => Promise.reject(new Error("offline")),
    });
    await broken.engine.loadAvailability();
    expect(broken.engine.getAvailability()).toBe("unavailable");
  });
});

describe("play", () => {
  test("plays click at full gain and normal rate through the master chain", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("click");
    await flush();
    const [source] = state.fake.sources;
    expect(source?.started).toBe(true);
    expect(source?.playbackRate.value).toBe(1);
    expect(state.fake.gains[0]?.gain.value).toBe(0.3);
    expect(state.fake.gains[1]?.gain.value).toBe(1);
    expect(state.fake.compressors).toHaveLength(1);
    expect(state.requested).toContain("/sounds/click.mp3");
    expect(state.fake.context.resumeCalls).toBe(1);
  });

  test("maps hover to click at 0.16 gain and 1.25 rate", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("hover");
    await flush();
    expect(state.fake.sources[0]?.playbackRate.value).toBe(1.25);
    expect(state.fake.gains[1]?.gain.value).toBe(0.16);
    expect(state.requested).toContain("/sounds/click.mp3");
  });

  test("maps every event to its file", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    const expected = {
      click: "click",
      switch: "sel2",
      theme: "theme",
      copy: "copy",
      cv: "cv",
      live: "live",
      pop: "pop",
    } as const;
    for (const [event, file] of Object.entries(expected)) {
      state.clock.now += 1000;
      state.engine.play(event as keyof typeof expected);
      await flush();
      expect(state.requested).toContain(`/sounds/${file}.mp3`);
    }
  });

  test("maps stackTick to a soft click", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("stackTick");
    await flush();
    expect(state.requested).toContain("/sounds/click.mp3");
    expect(state.fake.sources[0]?.playbackRate.value).toBe(1);
    expect(state.fake.gains[1]?.gain.value).toBe(0.12);
  });

  test("maps stackSettle to a slowed pop", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("stackSettle");
    await flush();
    expect(state.requested).toContain("/sounds/pop.mp3");
    expect(state.fake.sources[0]?.playbackRate.value).toBe(0.85);
    expect(state.fake.gains[1]?.gain.value).toBe(0.8);
  });

  test("lets a call override the playback rate", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("stackTick", { rate: 1.4 });
    await flush();
    expect(state.fake.sources[0]?.playbackRate.value).toBe(1.4);
    expect(state.fake.gains[1]?.gain.value).toBe(0.12);
  });

  test("creates one context and decodes each file once", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("click");
    state.clock.now += 100;
    state.engine.play("click");
    await flush();
    expect(state.contexts()).toBe(1);
    expect(state.fake.context.decoded).toHaveLength(1);
    expect(state.fake.sources).toHaveLength(2);
  });

  test("is silent while sound is off", async () => {
    const state = setup({ isEnabled: () => false });
    await state.engine.loadAvailability();
    state.engine.play("click");
    await flush();
    expect(state.contexts()).toBe(0);
    expect(state.fake.sources).toHaveLength(0);
  });

  test("is silent while the tab is hidden", async () => {
    const state = setup({ isHidden: () => true });
    await state.engine.loadAvailability();
    state.engine.play("click");
    await flush();
    expect(state.fake.sources).toHaveLength(0);
  });

  test("is silent when sounds are unavailable", async () => {
    const state = setup({}, undefined, true);
    await state.engine.loadAvailability();
    state.engine.play("click");
    await flush();
    expect(state.contexts()).toBe(0);
  });

  test("skips hover on devices without hover", async () => {
    const state = setup({ supportsHover: () => false });
    await state.engine.loadAvailability();
    state.engine.play("hover");
    state.clock.now += 1000;
    state.engine.play("click");
    await flush();
    expect(state.fake.sources).toHaveLength(1);
    expect(state.fake.sources[0]?.playbackRate.value).toBe(1);
  });

  test("enforces a 70ms gap for hover", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("hover");
    state.clock.now += 69;
    state.engine.play("hover");
    state.clock.now += 1;
    state.engine.play("hover");
    await flush();
    expect(state.fake.sources).toHaveLength(2);
  });

  test("enforces a 40ms gap for other events", async () => {
    const state = setup();
    await state.engine.loadAvailability();
    state.engine.play("click");
    state.clock.now += 39;
    state.engine.play("switch");
    state.clock.now += 1;
    state.engine.play("switch");
    await flush();
    expect(state.fake.sources).toHaveLength(2);
  });

  test("survives a failed file fetch and retries later", async () => {
    let failures = 1;
    const state = setup({
      fetch: (input) => {
        if (input.endsWith("manifest.json")) return Promise.resolve(Response.json(MANIFEST));
        if (failures > 0) {
          failures -= 1;
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve(new Response(new Uint8Array([1])));
      },
    });
    await state.engine.loadAvailability();
    state.engine.play("click");
    await flush();
    expect(state.fake.sources).toHaveLength(0);
    state.clock.now += 100;
    state.engine.play("click");
    await flush();
    expect(state.fake.sources).toHaveLength(1);
  });
});
