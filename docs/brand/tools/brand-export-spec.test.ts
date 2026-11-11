import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

import {
  assertSpec,
  AVATAR_SIZE,
  bannerHtml,
  effectiveSize,
  FORMATS,
  headlineOnScreen,
  KB,
  MARK_SIZES,
  MB,
  PANEL_HEIGHT,
  PANEL_LABELS,
  PANEL_MAX_BYTES,
  PANEL_WIDTH,
  panelHtml,
} from "./brand-export-spec.mjs";

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error: unknown) {
    return String(error);
  }
  return "";
}

function render(format: keyof typeof FORMATS, theme: "dark" | "light") {
  return bannerHtml({
    format,
    theme,
    wordmarkSvg: '<svg id="wordmark"></svg>',
    fontFaces: "@font-face{font-family:X}",
  });
}

describe("constants", () => {
  it("exposes the export sizes and budgets", () => {
    expect(MARK_SIZES).toEqual([16, 32, 48, 128, 512]);
    expect(AVATAR_SIZE).toBe(800);
    expect(MB).toBe(1024 * KB);
  });

  it("keeps the Open Graph image under 300 KB at 1200x630", () => {
    expect(FORMATS.og).toMatchObject({
      width: 1200,
      height: 630,
      maxBytes: 300 * KB,
    });
  });

  it("keeps every safe area inside its canvas", () => {
    for (const { width, height, safe } of Object.values(FORMATS)) {
      if (!safe) continue;
      expect(safe.left + safe.width).toBeLessThanOrEqual(width);
      expect(safe.top + safe.height).toBeLessThanOrEqual(height);
    }
  });

  it("keeps the YouTube content inside the 1546x423 safe area", () => {
    const { width, height, safe } = FORMATS["youtube-banner"];
    expect(safe).toBeDefined();
    expect(safe?.width).toBe(1546);
    expect(safe?.height).toBe(423);
    expect(safe?.left).toBe((width - 1546) / 2);
    expect(Math.abs((safe?.top ?? 0) - (height - 423) / 2)).toBeLessThanOrEqual(1);
  });
});

describe("twitch", () => {
  it("uses the Twitch native sizes", () => {
    expect(FORMATS["twitch-banner"]).toMatchObject({ width: 1200, height: 480 });
    expect(FORMATS["twitch-offline"]).toMatchObject({
      width: 1920,
      height: 1080,
    });
    expect(PANEL_WIDTH).toBe(320);
    expect(PANEL_MAX_BYTES).toBe(100 * KB);
  });

  it("shows the Twitch handle instead of the default one", () => {
    expect(render("twitch-banner", "dark")).toContain("twitch.tv/andryoredev");
    expect(render("og", "dark")).not.toContain("twitch.tv/andryoredev");
  });

  it("renders one panel header per label at 320 px wide", () => {
    for (const label of PANEL_LABELS) {
      const html = panelHtml({ label, fontFaces: "" });
      expect(html).toContain(`width:${String(PANEL_WIDTH)}px;height:${String(PANEL_HEIGHT)}px`);
      expect(html).toContain(`<span>${label}</span>`);
    }
  });

  it("rejects an unknown panel label", () => {
    expect(() => panelHtml({ label: "nope", fontFaces: "" })).toThrow("Unknown panel label");
  });
});

describe("legibility", () => {
  it("computes the on-screen size", () => {
    expect(effectiveSize(84, 0.4)).toBe(33.6);
  });

  it("keeps every headline above its minimum native size", () => {
    for (const { headlineSize, minHeadlinePx } of Object.values(FORMATS)) {
      expect(headlineSize).toBeGreaterThanOrEqual(minHeadlinePx);
    }
  });

  it("keeps every headline readable on a phone", () => {
    for (const format of Object.keys(FORMATS)) {
      const { phone } = headlineOnScreen(format as keyof typeof FORMATS);
      expect(phone).toBeGreaterThanOrEqual(15);
    }
  });

  it("keeps the headline at or above 30 px on a desktop", () => {
    for (const format of Object.keys(FORMATS)) {
      const { desktop } = headlineOnScreen(format as keyof typeof FORMATS);
      expect(desktop).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("bannerHtml", () => {
  it("embeds the wordmark, the fonts and the profile line", () => {
    const html = render("og", "dark");
    expect(html).toContain('<svg id="wordmark"></svg>');
    expect(html).toContain("@font-face{font-family:X}");
    expect(html).toContain("Building, exploring,");
    expect(html).toContain("telling");
    expect(html).toContain("width:1200px;height:630px");
  });

  it("renders the Spanish headline and lang for the es locale", () => {
    const html = bannerHtml({
      format: "og",
      theme: "dark",
      locale: "es",
      wordmarkSvg: "",
      fontFaces: "",
    });
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("Construyendo, explorando,");
    expect(html).toContain("contando");
    expect(html).not.toContain("telling");
  });

  it("uses the dark and light grounds of palette B7", () => {
    expect(render("og", "dark")).toContain("background-color:#0D1117");
    expect(render("og", "light")).toContain("background-color:#F1F3F6");
  });

  it("rejects an unknown format", () => {
    expect(() =>
      bannerHtml({
        format: "nope" as never,
        theme: "dark",
        wordmarkSvg: "",
        fontFaces: "",
      }),
    ).toThrow("Unknown banner format");
  });
});

describe("assertSpec", () => {
  let directory = "";
  let imagePath = "";

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "brand-spec-"));
    imagePath = path.join(directory, "image.png");
    await sharp({
      create: {
        width: 20,
        height: 10,
        channels: 3,
        background: "#1F5CFF",
      },
    })
      .png()
      .toFile(imagePath);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("passes when size and budget match, and logs the file", async () => {
    const logged: string[] = [];
    await assertSpec(
      imagePath,
      { width: 20, height: 10, maxBytes: 10 * KB },
      {
        repositoryRoot: directory,
        log: (message) => {
          logged.push(message);
        },
      },
    );
    expect(logged[0]).toMatch(/^image\.png \d+ KB$/);
  });

  it("throws on a size mismatch", async () => {
    const failure = await rejectionOf(
      assertSpec(imagePath, { width: 21, height: 10, maxBytes: 10 * KB }),
    );
    expect(failure).toContain("expected 21x10");
  });

  it("throws when over the byte budget", async () => {
    const failure = await rejectionOf(
      assertSpec(imagePath, { width: 20, height: 10, maxBytes: 1 }),
    );
    expect(failure).toContain("over 1");
  });
});
