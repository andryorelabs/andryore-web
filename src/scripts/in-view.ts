export interface VisibilityEntry {
  target: object;
  isIntersecting: boolean;
}

interface VisibilityObserver {
  observe(target: object): void;
  unobserve(target: object): void;
  disconnect(): void;
}

export type VisibilityObserverFactory = (
  callback: (entries: VisibilityEntry[]) => void,
) => VisibilityObserver;

export interface ObserveVisibilityOptions {
  createObserver: VisibilityObserverFactory | undefined;
  once?: boolean;
}

/**
 * Reports when targets enter and leave the viewport. Without an observer, such
 * as in an old browser, every target counts as visible at once so nothing
 * stays paused or at zero.
 * @param targets The elements to watch.
 * @param onChange Called with a target and whether it is visible.
 * @param options The observer factory, and `once` to stop watching a target
 *   after its first visible report.
 */
export function observeVisibility<Target extends object>(
  targets: readonly Target[],
  onChange: (target: Target, isVisible: boolean) => void,
  options: ObserveVisibilityOptions,
): void {
  const { createObserver, once = false } = options;
  if (!createObserver) {
    for (const target of targets) onChange(target, true);
    return;
  }
  const observer = createObserver((entries) => {
    for (const entry of entries) {
      if (once && !entry.isIntersecting) continue;
      onChange(entry.target as Target, entry.isIntersecting);
      if (once) observer.unobserve(entry.target);
    }
  });
  for (const target of targets) observer.observe(target);
}
