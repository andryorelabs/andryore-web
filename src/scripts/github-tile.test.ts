import { describe, expect, test } from "bun:test";

import { didMountGithubTile, type GithubTileRoot, type TileElement } from "./github-tile";

const NOW = new Date("2026-10-18T12:00:00Z");

const element = (): TileElement => {
  const dataset: Record<string, string | undefined> = {};
  return {
    textContent: "initial",
    dataset,
    setAttribute: (name, value) => {
      dataset[`attr:${name}`] = value;
    },
    replaceChildren: (...cells) => {
      dataset.cells = cells
        .map((cell) => `${cell.dataset.level ?? ""}|${cell.dataset.tip ?? ""}`)
        .join(",");
    },
  };
};

const createRoot = (locale = "en") => {
  const elements = new Map<string, TileElement>();
  const root: GithubTileRoot = {
    dataset: {
      locale,
      capturedAt: "2026-10-15",
      updatedPrefix: locale === "es" ? "Actualizado" : "Updated",
      gridLabel: "Grid",
      dayOne: locale === "es" ? "día" : "day",
      dayOther: locale === "es" ? "días" : "days",
      tipOne: "{count} contribution on {date}",
      tipOther: "{count} contributions on {date}",
      tipNone: "No contributions on {date}",
    },
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector) ?? null;
    },
  };
  return { root, text: (selector: string) => elements.get(selector) };
};

const live = {
  capturedAt: "2026-10-18",
  updatedAt: "2026-10-18T09:00:00.000Z",
  total: 1234,
  weeks: [
    [
      { date: "2026-10-16", count: 2, level: 2 },
      { date: "2026-10-17", count: 5, level: 4 },
    ],
  ],
};

describe("didMountGithubTile", () => {
  test("replaces total, grid, stats and label from the endpoint", async () => {
    const { root, text } = createRoot();
    const shown = await didMountGithubTile(root, {
      fetcher: () => Promise.resolve(Response.json(live)),
      now: () => NOW,
      createCell: () => ({ dataset: {} }),
    });
    expect(shown).toBe(true);
    expect(text("[data-count-total]")?.textContent).toBe("1,234");
    expect(text("[data-count-total]")?.dataset.countTotal).toBe("1234");
    expect(text("[data-gh-grid]")?.dataset.cells).toBe(
      "2|2 contributions on Oct 16, 2026,4|5 contributions on Oct 17, 2026",
    );
    expect(text('[data-gh-stat="longest"]')?.textContent).toBe("2");
    expect(text('[data-gh-stat="longest-unit"]')?.textContent).toBe("days");
    expect(text('[data-gh-stat="current-unit"]')?.textContent).toBe("days");
    expect(text('[data-gh-stat="active"]')?.textContent).toBe("2");
    expect(text('[data-gh-stat="best"]')?.textContent).toBe("5");
    expect(text('[data-gh-stat="best-date"]')?.textContent).toBe("Oct 17");
    expect(text("[data-gh-updated]")?.textContent).toBe("Updated 3 hours ago");
  });

  test("writes the label in Spanish", async () => {
    const { root, text } = createRoot("es");
    await didMountGithubTile(root, {
      fetcher: () => Promise.resolve(Response.json(live)),
      now: () => NOW,
      createCell: () => ({ dataset: {} }),
    });
    expect(text("[data-gh-updated]")?.textContent).toBe("Actualizado hace 3 horas");
  });

  test("keeps the snapshot and relabels it when the endpoint fails", async () => {
    const { root, text } = createRoot();
    const shown = await didMountGithubTile(root, {
      fetcher: () => Promise.resolve(new Response("x", { status: 503 })),
      now: () => NOW,
      createCell: () => ({ dataset: {} }),
    });
    expect(shown).toBe(false);
    expect(text("[data-gh-grid]")).toBeUndefined();
    expect(text("[data-gh-updated]")?.textContent).toBe("Updated 3 days ago");
  });
});
