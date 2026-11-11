import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (relative: string): string =>
  readFileSync(path.join(import.meta.dir, "..", relative), "utf8");

describe("sound wiring in Astro files", () => {
  test("the 404 emoji pops", () => {
    expect(read("components/NotFoundPage.astro")).toMatch(
      /class="nf-monocle"[^>]*data-sound="pop"/,
    );
  });

  test("the copy email button copies with its own sound", () => {
    expect(read("components/CopyEmailButton.tsx")).toContain('data-sound="copy"');
  });

  test("the FX tile plays the switch sound and hides without audio", () => {
    const source = read("components/FxTile.astro");
    expect(source).toContain('data-sound="switch"');
    expect(source).toContain("mountFxAvailability(element, soundEngine)");
  });

  test("the layout mounts the delegated triggers once", () => {
    const source = read("layouts/BaseLayout.astro");
    expect(source.match(/soundTriggers\.mount\(document\)/g)).toHaveLength(1);
  });

  test("the stream tile plays live only after a gesture", () => {
    expect(read("components/StreamTile.astro")).toContain('soundTriggers.playUnlocked("live")');
  });

  test("no sound code adds inline styles", () => {
    for (const file of [
      "components/FxTile.astro",
      "components/NotFoundPage.astro",
      "scripts/sound-triggers.ts",
    ])
      expect(read(file)).not.toContain("style=");
  });
});
