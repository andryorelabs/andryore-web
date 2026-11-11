import { describe, expect, test } from "bun:test";

import stackScene from "../content/stack-scene.json";
import uses from "../content/uses.json";
import { LOCALES } from "../i18n/locales";
import { ICONS } from "./icons";
import {
  END_CARD_TILES,
  GLOW_CLASSES,
  glowHex,
  NOT_FOUND_DELAYS,
  NOT_FOUND_TILES,
  sizeClass,
  STACK_TILES,
  stackToolCount,
} from "./stack-scene";

const usesIcons = (locale: "en" | "es"): Set<string> =>
  new Set([
    ...uses[locale].tools.map((badge) => badge.icon),
    ...uses[locale].tech.map((badge) => badge.icon),
  ]);

describe("STACK_TILES", () => {
  test("holds 24 unique tiles, 12 of them on mobile", () => {
    expect(STACK_TILES).toHaveLength(24);
    expect(new Set(STACK_TILES.map((tile) => tile.id)).size).toBe(24);
    expect(STACK_TILES.filter((tile) => tile.mobile)).toHaveLength(12);
  });

  test("every tile is a tool or tech of the Uses data", () => {
    for (const locale of LOCALES)
      for (const tile of STACK_TILES) expect(usesIcons(locale).has(tile.id)).toBe(true);
  });

  test("keeps the first twelve tiles of the canvas on mobile", () => {
    expect(STACK_TILES.slice(0, 12).every((tile) => tile.mobile)).toBe(true);
    expect(STACK_TILES.slice(12).some((tile) => tile.mobile)).toBe(false);
  });

  test("follows the canvas order, sizes and offsets", () => {
    expect(STACK_TILES.map((tile) => tile.id).slice(0, 4)).toEqual([
      "typescript",
      "astro",
      "react",
      "nextjs",
    ]);
    expect(STACK_TILES[0]?.placement).toBe("[--x:-430] [--y:-200] [--r:-8]");
    expect(STACK_TILES.filter((tile) => tile.size === 96)).toHaveLength(4);
    expect(STACK_TILES.filter((tile) => tile.size === 72)).toHaveLength(4);
    expect(STACK_TILES.filter((tile) => tile.size === 56)).toHaveLength(16);
  });

  test("swaps hono, better-auth and github-actions for the canvas tiles", () => {
    const ids = STACK_TILES.map((tile) => tile.id);
    for (const id of ["astro", "turborepo", "bitwarden"] as const) expect(ids).toContain(id);
    for (const id of ["hono", "better-auth", "github-actions"]) expect(ids).not.toContain(id);
  });

  test("uses the three sizes and a placement per tile", () => {
    expect(new Set(STACK_TILES.map((tile) => tile.size))).toEqual(new Set([96, 72, 56]));
    expect(new Set(STACK_TILES.map((tile) => tile.placement)).size).toBe(24);
  });
});

describe("NOT_FOUND_TILES", () => {
  test("places the 12 canvas tiles by top-left percent, each at its own angle", () => {
    expect(NOT_FOUND_TILES.map((tile) => tile.id)).toEqual([
      "typescript",
      "react",
      "astro",
      "nextjs",
      "bun",
      "shadcn-ui",
      "docker",
      "tailwindcss",
      "claude",
      "linear",
      "playwright",
      "prisma",
    ]);
    expect(new Set(NOT_FOUND_TILES.map((tile) => tile.placement)).size).toBe(12);
    expect(NOT_FOUND_TILES[0]).toMatchObject({
      size: 84,
      placement: "left-[8%] top-[14%] [--r:-14deg]",
      delay: 0.5,
    });
    expect(NOT_FOUND_TILES[11]).toMatchObject({
      size: 44,
      placement: "left-[92%] top-[82%] [--r:40deg]",
      delay: 0.3,
    });
  });

  test("lists every distinct delay once, ascending", () => {
    expect(NOT_FOUND_DELAYS).toHaveLength(12);
    expect(NOT_FOUND_DELAYS).toEqual([...NOT_FOUND_DELAYS].toSorted((a, b) => a - b));
  });
});

describe("stackToolCount", () => {
  test("matches the tools and tech listed on the Uses page", () => {
    for (const locale of LOCALES) {
      expect(stackToolCount(locale)).toBe(uses[locale].tools.length + uses[locale].tech.length);
    }
    expect(stackToolCount("en")).toBe(40);
  });

  test("is what the copy shows through its count placeholder", () => {
    for (const locale of LOCALES) {
      expect(stackScene[locale].count).toContain("{count}");
    }
  });
});

describe("glow", () => {
  test("every scene icon exists and has a glow class", () => {
    const ids = [...STACK_TILES, ...NOT_FOUND_TILES, ...END_CARD_TILES].map((tile) => tile.id);
    for (const id of ids) {
      expect(Object.hasOwn(ICONS, id)).toBe(true);
      expect(Object.hasOwn(GLOW_CLASSES, id)).toBe(true);
    }
  });

  test("black and white logos glow neutral, the rest in their brand hex", () => {
    for (const id of ["nextjs", "shadcn-ui", "resend", "tailscale"] as const)
      expect(glowHex(id)).toBe("#8b93a7");
    expect(glowHex("typescript")).toBe("#3178c6");
  });

  test("takes the canvas glow colours", () => {
    expect(glowHex("astro")).toBe("#ff5d01");
    expect(glowHex("tailwindcss")).toBe("#38bdf8");
    expect(glowHex("turborepo")).toBe("#ef4444");
    expect(glowHex("bitwarden")).toBe("#175ddc");
    expect(glowHex("eslint")).toBe("#8080f2");
  });
});

describe("END_CARD_TILES", () => {
  test("lists the five tiles in order with the five tilts", () => {
    expect(END_CARD_TILES.map((tile) => tile.id)).toEqual([
      "typescript",
      "astro",
      "react",
      "bun",
      "shadcn-ui",
    ]);
    expect(END_CARD_TILES.map((tile) => tile.tilt)).toEqual([
      "-rotate-[7deg]",
      "rotate-[4deg]",
      "-rotate-[3deg]",
      "rotate-[6deg]",
      "-rotate-[5deg]",
    ]);
  });
});

describe("sizeClass", () => {
  test("maps each size to a literal custom property class", () => {
    expect(sizeClass(96)).toBe("[--s:96]");
    expect(sizeClass(72)).toBe("[--s:72]");
    expect(sizeClass(56)).toBe("[--s:56]");
  });
});
