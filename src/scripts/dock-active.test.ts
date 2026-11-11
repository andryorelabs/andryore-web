import { describe, expect, test } from "bun:test";

import { mountDockActive, type DockAnchor, type SectionEntry } from "./dock-active";

const KEYS = ["home", "about", "products", "uses", "findMe"];

const setup = (hash: string, hasObserver = true) => {
  const page = { atEnd: false };
  const scrollListeners: (() => void)[] = [];
  const current = new Map<string, boolean>();
  const anchors: DockAnchor[] = KEYS.map((key) => ({
    dataset: { dockPage: key },
    setAttribute: (name, value) => {
      if (name === "aria-current" && value === "page") current.set(key, true);
    },
    removeAttribute: (name) => {
      if (name === "aria-current") current.delete(key);
    },
  }));
  const reporters: ((entries: SectionEntry[]) => void)[] = [];
  const observed: object[] = [];
  mountDockActive({
    anchors,
    findSection: (id) => ({ id }),
    hash,
    atPageEnd: () => page.atEnd,
    onScroll: (listener) => {
      scrollListeners.push(listener);
    },
    createObserver: hasObserver
      ? (callback) => {
          reporters.push(callback);
          return {
            observe: (target) => {
              observed.push(target);
            },
          };
        }
      : undefined,
  });
  const marked = (): string[] => current.keys().toArray();
  const see = (id: string, isIntersecting: boolean): void => {
    for (const report of reporters) report([{ target: { id }, isIntersecting }]);
  };
  const scrollTo = (isAtEnd: boolean): void => {
    page.atEnd = isAtEnd;
    for (const listener of scrollListeners) listener();
  };
  return { marked, see, observed, scrollTo };
};

describe("mountDockActive", () => {
  test("marks Home at the top", () => {
    expect(setup("").marked()).toEqual(["home"]);
  });

  test.each([
    ["#products", "products"],
    ["#find-me", "findMe"],
  ])("starts from the hash %s", (hash, key) => {
    expect(setup(hash).marked()).toEqual([key]);
  });

  test("follows the sections on scroll and returns to Home", () => {
    const { marked, see, observed } = setup("");
    expect(observed).toHaveLength(2);
    see("products", true);
    expect(marked()).toEqual(["products"]);
    see("products", false);
    see("find-me", true);
    expect(marked()).toEqual(["findMe"]);
    see("find-me", false);
    expect(marked()).toEqual(["home"]);
  });

  test("marks Find me at the end of the page and keeps it on the first empty report", () => {
    const { marked, see, scrollTo } = setup("#find-me");
    scrollTo(true);
    see("products", false);
    expect(marked()).toEqual(["findMe"]);
    scrollTo(false);
    expect(marked()).toEqual(["home"]);
  });

  test("applies only the hash without an observer", () => {
    expect(setup("#products", false).marked()).toEqual(["products"]);
  });

  test("skips sections missing from the page", () => {
    const anchors: DockAnchor[] = [];
    const observed: object[] = [];
    mountDockActive({
      anchors,
      findSection: () => null,
      hash: "",
      createObserver: () => ({
        observe: (target) => {
          observed.push(target);
        },
      }),
    });
    expect(observed).toEqual([]);
  });
});
