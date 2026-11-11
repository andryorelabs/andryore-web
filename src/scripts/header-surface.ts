import { observeVisibility, type VisibilityObserverFactory } from "./in-view";

interface HeaderTarget {
  toggleAttribute(name: string, isForced?: boolean): boolean;
}

/**
 * Marks the header as scrolled once the sentinel at the top of the page leaves
 * the viewport, so the surface shows in every browser and under reduced
 * motion. Without an observer the header stays transparent.
 * @param header The sticky header to mark with `data-scrolled`.
 * @param sentinel The element that is visible only at the top of the page.
 * @param createObserver The intersection observer factory, when available.
 */
export function watchHeaderSurface(
  header: HeaderTarget,
  sentinel: object,
  createObserver: VisibilityObserverFactory | undefined,
): void {
  observeVisibility(
    [sentinel],
    (_target, visible) => {
      header.toggleAttribute("data-scrolled", !visible);
    },
    { createObserver },
  );
}
