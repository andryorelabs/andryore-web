import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { tintSvg } from "./tint-svg";

const iconPath = (name: string): string =>
  path.join(import.meta.dir, "..", "assets", "icons", `${name}.svg`);

describe("tintSvg", () => {
  test("recolours solid fills and strokes but keeps none", () => {
    const tinted = tintSvg(
      '<svg><g fill="none"><path fill="#38bdf8"/><path stroke="#fff"/></g></svg>',
      18,
    );
    expect(tinted).toContain('<g fill="none">');
    expect(tinted).toContain('<path fill="currentColor"/>');
    expect(tinted).toContain('<path stroke="currentColor"/>');
  });

  test("sizes the root and hides it from assistive technology", () => {
    const tinted = tintSvg('<svg viewBox="0 0 1 1"></svg>', 18);
    expect(tinted).toStartWith(
      '<svg width="18" height="18" aria-hidden="true" focusable="false" viewBox',
    );
  });

  test("drops the TypeScript tile and keeps the letters", () => {
    const tinted = tintSvg(readFileSync(iconPath("typescript"), "utf8"), 18);
    expect(tinted).not.toContain("#3178C6");
    expect(tinted).not.toContain("M20 0h216");
    expect(tinted.match(/<path/g)).toHaveLength(1);
    expect(tinted).toContain('fill="currentColor"');
  });

  test("leaves no hard-coded colour in the stack logos", () => {
    for (const name of ["react", "astro", "tailwindcss", "shadcn-ui", "wxt"]) {
      const tinted = tintSvg(readFileSync(iconPath(name), "utf8"), 18);
      expect(tinted, name).not.toMatch(/(?:fill|stroke)="#/);
    }
  });
});
