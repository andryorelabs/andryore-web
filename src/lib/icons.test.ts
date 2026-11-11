import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ICON_DIRECTORY, ICONS, resolveIcon, type IconId } from "./icons";

const ICON_ROOT = path.resolve(import.meta.dir, "../assets/icons");
const iconIds = Object.keys(ICONS) as IconId[];
const sources = readFileSync(path.join(ICON_ROOT, "SOURCES.md"), "utf8");
const svgFiles = readdirSync(ICON_ROOT).filter((file) => file.endsWith(".svg"));

const readIcon = (file: string): string => readFileSync(path.join(ICON_ROOT, file), "utf8");

const referencedFiles = (): Set<string> => {
  const files = new Set<string>();
  for (const id of iconIds) {
    const { light, dark } = resolveIcon(id);
    files.add(path.basename(light));
    files.add(path.basename(dark));
  }
  return files;
};

describe("icons", () => {
  test("every id resolves to existing light and dark files", () => {
    for (const id of iconIds) {
      const { light, dark } = resolveIcon(id);
      for (const asset of [light, dark]) {
        expect(asset.startsWith(ICON_DIRECTORY)).toBe(true);
        const onDisk = path.join(ICON_ROOT, path.basename(asset));
        expect(existsSync(onDisk)).toBe(true);
      }
    }
  });

  test("every file is referenced by the lookup and listed in SOURCES.md", () => {
    const referenced = referencedFiles();
    for (const file of svgFiles) {
      expect(referenced.has(file)).toBe(true);
      expect(sources).toContain(`\`${file}\``);
    }
  });

  test("every file keeps a viewBox and carries no size, raster or script", () => {
    for (const file of svgFiles) {
      const content = readIcon(file);
      const rootTag = /<svg\b[^>]*>/.exec(content)?.[0] ?? "";
      expect(rootTag).toContain("viewBox=");
      expect(rootTag).not.toMatch(/\s(?:width|height)=/);
      expect(content).not.toMatch(/<image\b|data:image|<script/i);
    }
  });

  test("brand hex values are six-digit colours", () => {
    for (const id of iconIds) {
      const { hex } = resolveIcon(id);
      if (hex !== undefined) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("the Ao mark pairs currentColor with the primary blue", () => {
    const light = readIcon("ao-mark.svg");
    expect(light).toContain("currentColor");
    expect(light).toContain("#1F5CFF");
  });
});
