import { getFxStorage, isFxEnabled } from "../lib/fx-store";
import type { PlayOptions, SoundEvent } from "../lib/sound-engine";
import { createStackSoundMapper, sceneProgress, type StackSoundCue } from "../lib/stack-sound";
import { soundTriggers } from "./sound-triggers";

/**
The tile count at and below the 40rem breakpoint.
 */
const COMPACT_TILE_COUNT = 12;

/**
The tile count above the 40rem breakpoint.
 */
const FULL_TILE_COUNT = 24;

/**
The view the script reads: where the scene is and how tall the screen is.
 */
export interface StackSoundScene {
  getBoundingClientRect: () => { top: number; height: number };
}

/**
A running observer the script can stop.
 */
interface StackSoundObserver {
  observe: (target: StackSoundScene) => void;
  disconnect: () => void;
}

/**
The browser pieces the script needs, replaceable in tests.
 */
export interface StackSoundDependencies {
  isSoundOn: () => boolean;
  isUnlocked: () => boolean;
  isHidden: () => boolean;
  isMotionReduced: () => boolean;
  supportsScrollTimeline: () => boolean;
  isCompact: () => boolean;
  viewportHeight: () => number;
  now: () => number;
  play: (event: SoundEvent, options?: PlayOptions) => void;
  requestFrame: (callback: () => void) => void;
  addScrollListener: (listener: () => void) => void;
  removeScrollListener: (listener: () => void) => void;
  createObserver: (onChange: (isNear: boolean) => void) => StackSoundObserver;
}

/**
 * Plays the Stack scene sounds while its scroll animation runs. The scroll
 * listener is attached only while the scene is near the viewport, reads the
 * progress once per animation frame, and plays only when sound is on, the
 * audio was unlocked by an earlier gesture, the tab is visible, motion is not
 * reduced and scroll timelines are supported.
 * @param scene The Stack scene element.
 * @param dependencies The browser pieces.
 * @returns A function that stops the script.
 */
export function mountStackSound(
  scene: StackSoundScene,
  dependencies: StackSoundDependencies,
): () => void {
  const mapper = createStackSoundMapper();
  let isFramePending = false;
  let isAttached = false;

  const canPlay = (): boolean =>
    dependencies.supportsScrollTimeline() &&
    !dependencies.isMotionReduced() &&
    !dependencies.isHidden() &&
    dependencies.isSoundOn() &&
    dependencies.isUnlocked();

  const readCue = (): StackSoundCue => {
    const progress = sceneProgress(scene.getBoundingClientRect(), dependencies.viewportHeight());
    const tileCount = dependencies.isCompact() ? COMPACT_TILE_COUNT : FULL_TILE_COUNT;
    return mapper.update(progress, tileCount, dependencies.now());
  };

  const playCue = (cue: StackSoundCue): void => {
    if (!canPlay()) return;
    if (cue.settle) {
      dependencies.play("stackSettle");
      return;
    }
    if (cue.tickRate !== undefined) dependencies.play("stackTick", { rate: cue.tickRate });
  };

  const measure = (): void => {
    isFramePending = false;
    playCue(readCue());
  };

  const onScroll = (): void => {
    if (isFramePending) return;
    isFramePending = true;
    dependencies.requestFrame(measure);
  };

  const attach = (): void => {
    if (isAttached) return;
    isAttached = true;
    measure();
    dependencies.addScrollListener(onScroll);
  };

  const detach = (): void => {
    if (!isAttached) return;
    isAttached = false;
    dependencies.removeScrollListener(onScroll);
  };

  if (!dependencies.supportsScrollTimeline()) return detach;

  const observer = dependencies.createObserver((isNear) => {
    if (isNear) attach();
    else detach();
  });
  observer.observe(scene);
  return () => {
    observer.disconnect();
    detach();
  };
}

/**
 * Mounts the sound on a scene in the browser.
 * @param scene The Stack scene element.
 * @returns A function that stops the script.
 */
export function mountStackSoundInBrowser(scene: HTMLElement): () => void {
  return mountStackSound(scene, {
    isSoundOn: () => isFxEnabled(getFxStorage()),
    isUnlocked: soundTriggers.isUnlocked,
    isHidden: () => document.hidden,
    isMotionReduced: () => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
    supportsScrollTimeline: () => CSS.supports("animation-timeline: view()"),
    isCompact: () => globalThis.matchMedia("(max-width: 40rem)").matches,
    viewportHeight: () => globalThis.innerHeight,
    now: () => performance.now(),
    play: (event, options) => {
      soundTriggers.playUnlocked(event, options);
    },
    requestFrame: (callback) => {
      globalThis.requestAnimationFrame(callback);
    },
    addScrollListener: (listener) => {
      globalThis.addEventListener("scroll", listener, { passive: true });
    },
    removeScrollListener: (listener) => {
      globalThis.removeEventListener("scroll", listener);
    },
    createObserver: (onChange) => {
      const observer = new IntersectionObserver(
        (entries) => {
          const latest = entries.at(-1);
          if (latest) onChange(latest.isIntersecting);
        },
        { rootMargin: "100% 0px" },
      );
      return {
        observe: () => {
          observer.observe(scene);
        },
        disconnect: () => {
          observer.disconnect();
        },
      };
    },
  });
}
