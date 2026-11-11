import { describe, expect, test } from "bun:test";

import about from "../content/about.json";
import githubGrid from "../content/github-grid.json";
import home from "../content/home.json";
import { buildNumberStats } from "./about";

describe("buildNumberStats", () => {
  const sources = {
    installs: { total: 75_000 },
    contributions: 1234,
  };

  test("takes contributions from the supplied GitHub total, not a literal", () => {
    const stats = buildNumberStats(about.en, sources, "en");
    const contributions = stats.find((stat) => stat.key === "contributions");
    expect(contributions?.count).toBe(1234);
    expect(contributions?.display).toBe("1,234");
    const other = buildNumberStats(
      about.en,
      { ...sources, contributions: githubGrid.total },
      "en",
    ).find((stat) => stat.key === "contributions");
    expect(other?.count).toBe(githubGrid.total);
  });

  test("leaves the contributions figure out without a snapshot", () => {
    const keys = buildNumberStats(about.en, { ...sources, contributions: undefined }, "en").map(
      (stat) => stat.key,
    );
    expect(keys).toEqual(["independent", "snug", "installs"]);
  });

  test("keeps the GitHub total out of the copy", () => {
    expect(JSON.stringify(about)).not.toContain(String(githubGrid.total));
  });

  test("shows the installs figure with a plus and no dated note", () => {
    const installs = buildNumberStats(about.en, sources, "en").find(
      (stat) => stat.key === "installs",
    );
    expect(installs?.suffix).toBe("+");
    expect(installs).not.toHaveProperty("note");
  });

  test("groups four-digit figures in Spanish like the canvas", () => {
    const snug = buildNumberStats(about.es, sources, "es").find((stat) => stat.key === "snug");
    expect(snug?.display).toBe("5.000");
  });

  test("uses the same installs total as the Home contribution row", () => {
    expect(home.en.products.contribution.metaTotal).toBe(75_000);
  });
});
