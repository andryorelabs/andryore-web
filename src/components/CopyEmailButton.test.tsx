import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import CopyEmailButton from "./CopyEmailButton";

const DOM_KEYS = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "Event",
  "MouseEvent",
  "CustomEvent",
  "getComputedStyle",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
] as const;

const COPY = {
  copyLabel: "Copy email",
  copiedMessage: "Email copied",
  selectedMessage: "Email selected",
};

const saved = new Map<string, PropertyDescriptor | undefined>();
const mounted: Root[] = [];
const state = {
  written: [] as string[],
  clipboardMode: "works" as "works" | "rejects" | "missing",
  selectedRanges: 0,
  clearedSelections: 0,
};

const define = (key: string, value: unknown): void => {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
};

const stubClipboard = () => ({
  writeText: (text: string): Promise<void> => {
    if (state.clipboardMode === "rejects") return Promise.reject(new Error("denied"));
    state.written.push(text);
    return Promise.resolve();
  },
});

const stubSelection = () => ({
  removeAllRanges: () => {
    state.clearedSelections += 1;
  },
  addRange: () => {
    state.selectedRanges += 1;
  },
});

beforeAll(() => {
  const domWindow = new Window({ url: "http://localhost/" });
  const source = domWindow as unknown as Record<string, unknown>;
  for (const key of DOM_KEYS) {
    const value = key === "window" ? domWindow : source[key];
    define(key, typeof value === "function" ? (value as () => unknown).bind(domWindow) : value);
  }
  define("IS_REACT_ACT_ENVIRONMENT", true);
  define("getSelection", stubSelection);
});

beforeEach(() => {
  state.written = [];
  state.selectedRanges = 0;
  state.clearedSelections = 0;
  state.clipboardMode = "works";
  define("navigator", { clipboard: stubClipboard() });
});

afterEach(() => {
  act(() => {
    for (const root of mounted) root.unmount();
  });
  mounted.length = 0;
  document.body.replaceChildren();
});

afterAll(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const mountButton = (): HTMLElement => {
  const target = document.createElement("span");
  target.id = "email-target";
  target.textContent = "hello@andryore.dev";
  document.body.append(target);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  act(() => {
    root.render(<CopyEmailButton email="hello@andryore.dev" targetId="email-target" copy={COPY} />);
  });
  return container;
};

const clickCopy = async (container: HTMLElement): Promise<void> => {
  const button = container.querySelector<HTMLButtonElement>("[data-copy-email]");
  await act(async () => {
    button?.click();
    await Promise.resolve();
  });
};

describe("CopyEmailButton", () => {
  test("renders a labelled button and an empty status", () => {
    const container = mountButton();
    expect(container.querySelector("[data-copy-email]")?.getAttribute("aria-label")).toBe(
      COPY.copyLabel,
    );
    expect(container.querySelector("[role=status]")?.textContent).toBe("");
    expect(container.querySelector("[data-particle-burst]")).toBeNull();
  });

  test("copies the email, announces it and bursts particles", async () => {
    const container = mountButton();
    await clickCopy(container);
    expect(state.written).toEqual(["hello@andryore.dev"]);
    expect(container.querySelector("[role=status]")?.textContent).toBe(COPY.copiedMessage);
    expect(container.querySelectorAll(":scope [data-particle-burst] .particle")).toHaveLength(6);
  });

  test("selects the email when the clipboard rejects", async () => {
    state.clipboardMode = "rejects";
    const container = mountButton();
    await clickCopy(container);
    expect(state.selectedRanges).toBe(1);
    expect(state.clearedSelections).toBe(1);
    expect(container.querySelector("[role=status]")?.textContent).toBe(COPY.selectedMessage);
    expect(container.querySelector("[data-particle-burst]")).toBeNull();
  });

  test("selects the email when there is no clipboard", async () => {
    define("navigator", {});
    const container = mountButton();
    await clickCopy(container);
    expect(state.selectedRanges).toBe(1);
    expect(state.clearedSelections).toBe(1);
    expect(container.querySelector("[role=status]")?.textContent).toBe(COPY.selectedMessage);
  });

  test("does nothing visible to the selection when the target is missing", async () => {
    define("navigator", {});
    const container = mountButton();
    document.querySelector("#email-target")?.remove();
    await clickCopy(container);
    expect(state.selectedRanges).toBe(0);
  });

  test("clears the status after the reset delay", async () => {
    const container = mountButton();
    await clickCopy(container);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2600));
    });
    expect(container.querySelector("[role=status]")?.textContent).toBe("");
  });
});
