import { getFxStorage, isFxEnabled } from "./fx-store";

/**
 * The audio files of the Glass set, served from `/sounds/<name>.mp3`.
 */
export const SOUND_FILES = ["click", "sel2", "theme", "copy", "cv", "live", "pop"] as const;

/**
 * The name of one audio file of the Glass set.
 * @public
 */
export type SoundFile = (typeof SOUND_FILES)[number];

/**
 * How an interface event is played: which file, how loud, how fast.
 */
interface SoundDefinition {
  file: SoundFile;
  gain: number;
  rate: number;
}

/**
 * The interface events mapped to the Glass set, as in the canvas.
 */
const SOUND_PACK = {
  hover: { file: "click", gain: 0.16, rate: 1.25 },
  click: { file: "click", gain: 1, rate: 1 },
  switch: { file: "sel2", gain: 1, rate: 1 },
  theme: { file: "theme", gain: 1, rate: 1 },
  copy: { file: "copy", gain: 1, rate: 1 },
  cv: { file: "cv", gain: 1, rate: 1 },
  live: { file: "live", gain: 1, rate: 1 },
  pop: { file: "pop", gain: 1, rate: 1 },
  stackTick: { file: "click", gain: 0.12, rate: 1 },
  stackSettle: { file: "pop", gain: 0.8, rate: 0.85 },
} as const satisfies Record<string, SoundDefinition>;

/**
 * An interface event that can make a sound.
 * @public
 */
export type SoundEvent = keyof typeof SOUND_PACK;

/**
 * What the build step writes next to the audio files.
 */
export interface SoundManifest {
  sounds: readonly SoundFile[];
}

/**
 * Whether the audio files are known to be served.
 * @public
 */
export type SoundAvailability = "unknown" | "available" | "unavailable";

/**
 * The browser pieces the engine needs, replaceable in tests.
 */
export interface SoundEngineDependencies {
  createContext: () => AudioContext | undefined;
  fetch: (input: string) => Promise<Response>;
  now: () => number;
  isHidden: () => boolean;
  isEnabled: () => boolean;
  supportsHover: () => boolean;
}

/**
 * Per-call overrides of how an event plays.
 */
export interface PlayOptions {
  rate?: number;
}

/**
 * The public surface of the sound engine.
 */
export interface SoundEngine {
  getAvailability: () => SoundAvailability;
  isAvailable: () => boolean;
  loadAvailability: () => Promise<void>;
  subscribeAvailability: (onChange: () => void) => () => void;
  play: (event: SoundEvent, options?: PlayOptions) => void;
}

const MANIFEST_URL = "/sounds/manifest.json";
const MASTER_GAIN = 0.3;
const HOVER_GAP_MS = 70;
const DEFAULT_GAP_MS = 40;

/**
 * Checks that a parsed JSON value lists every sound of the Glass set.
 * @param value Anything parsed from `manifest.json`.
 * @returns True when the value is a complete manifest.
 */
export function isSoundManifest(value: unknown): value is SoundManifest {
  if (typeof value !== "object" || value === null) return false;
  const sounds = (value as { sounds?: unknown }).sounds;
  return Array.isArray(sounds) && SOUND_FILES.every((name) => (sounds as unknown[]).includes(name));
}

/**
 * Builds a sound engine. It plays only after a user gesture, only while Sound
 * is on, the tab is visible and the audio files are served.
 * @param dependencies Fetch, clock, visibility and the Sound preference.
 * @returns An engine that stays silent until sounds are known to be served.
 */
export function createSoundEngine(dependencies: SoundEngineDependencies): SoundEngine {
  let availability: SoundAvailability = "unknown";
  let loading: Promise<boolean> | undefined;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let lastPlayedAt = -Infinity;
  const buffers = new Map<SoundFile, Promise<AudioBuffer>>();
  const listeners = new Set<() => void>();

  const didSettle = (next: SoundAvailability): boolean => {
    availability = next;
    listeners.forEach((listener) => {
      listener();
    });
    return next === "available";
  };

  const isAvailableAfterFetch = async (): Promise<boolean> => {
    try {
      const response = await dependencies.fetch(MANIFEST_URL);
      if (!response.ok) return didSettle("unavailable");
      const manifest: unknown = await response.json();
      return didSettle(isSoundManifest(manifest) ? "available" : "unavailable");
    } catch {
      return didSettle("unavailable");
    }
  };

  const loadAvailability = async (): Promise<void> => {
    loading ??= isAvailableAfterFetch();
    await loading;
  };

  const ensureContext = (): AudioContext | undefined => {
    if (context) return context;
    const created = dependencies.createContext();
    if (!created) return undefined;
    const compressor = created.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 4;
    master = created.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(compressor);
    compressor.connect(created.destination);
    context = created;
    return created;
  };

  const decodeFile = async (audio: AudioContext, file: SoundFile): Promise<AudioBuffer> => {
    try {
      const response = await dependencies.fetch(`/sounds/${file}.mp3`);
      return await audio.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      buffers.delete(file);
      throw error;
    }
  };

  const loadBuffer = (audio: AudioContext, file: SoundFile): Promise<AudioBuffer> => {
    const cached = buffers.get(file);
    if (cached) return cached;
    const pending = decodeFile(audio, file);
    buffers.set(file, pending);
    return pending;
  };

  const start = async (
    audio: AudioContext,
    output: GainNode,
    definition: SoundDefinition,
    rate: number,
  ): Promise<void> => {
    try {
      const [buffer] = await Promise.all([
        loadBuffer(audio, definition.file),
        audio.state === "suspended" ? audio.resume() : undefined,
      ]);
      const source = audio.createBufferSource();
      const level = audio.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      level.gain.value = definition.gain;
      source.connect(level);
      level.connect(output);
      source.start();
    } catch {
      return;
    }
  };

  const play = (event: SoundEvent, options?: PlayOptions): void => {
    if (availability !== "available" || !dependencies.isEnabled() || dependencies.isHidden())
      return;
    if (event === "hover" && !dependencies.supportsHover()) return;
    const definition: SoundDefinition = SOUND_PACK[event];
    const now = dependencies.now();
    const gap = event === "hover" ? HOVER_GAP_MS : DEFAULT_GAP_MS;
    if (now - lastPlayedAt < gap) return;
    lastPlayedAt = now;
    const audio = ensureContext();
    if (!audio || !master) return;
    void start(audio, master, definition, options?.rate ?? definition.rate);
  };

  return {
    getAvailability: () => availability,
    isAvailable: () => availability === "available",
    loadAvailability,
    subscribeAvailability: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    play,
  };
}

const browserDependencies: SoundEngineDependencies = {
  createContext: () => {
    const scope = globalThis as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
    return Constructor ? new Constructor() : undefined;
  },
  fetch: (input) => globalThis.fetch(input),
  now: () => performance.now(),
  isHidden: () => document.hidden,
  isEnabled: () => isFxEnabled(getFxStorage()),
  supportsHover: () => globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches,
};

/**
 * The sound engine of the page, wired to the browser.
 * @public
 */
export const soundEngine: SoundEngine = createSoundEngine(browserDependencies);
