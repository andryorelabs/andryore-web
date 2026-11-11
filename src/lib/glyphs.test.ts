import { describe, expect, test } from "bun:test";

import { GLYPH_BODIES, glyphSvg, type GlyphName } from "./glyphs";

const glyphNames = Object.keys(GLYPH_BODIES) as GlyphName[];

describe("glyphs", () => {
  test("renders every glyph as a decorative inline svg", () => {
    for (const name of glyphNames) {
      const markup = glyphSvg(name, 20);
      expect(markup.startsWith("<svg")).toBe(true);
      expect(markup).toContain('width="20"');
      expect(markup).toContain('aria-hidden="true"');
    }
  });

  test("includes the upload glyph", () => {
    expect(glyphNames).toContain("upload");
  });

  test("ships the full canvas set", () => {
    expect(glyphNames).toHaveLength(58);
  });
});
