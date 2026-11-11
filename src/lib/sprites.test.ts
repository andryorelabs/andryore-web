import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { spriteClass } from "./sprites";

const stylesheet = readFileSync(
  path.resolve(import.meta.dir, "..", "styles", "global.css"),
  "utf8",
);

describe("spriteClass", () => {
  test("maps the strip lengths in use to a class", () => {
    expect(spriteClass(48)).toBe("sprite-48");
    expect(spriteClass(61)).toBe("sprite-61");
  });

  test("leaves a still frame without an animation", () => {
    expect(spriteClass(1)).toBeUndefined();
  });

  test("every class has timing in the stylesheet", () => {
    for (const frames of [48, 61]) {
      expect(stylesheet).toContain(`@utility ${spriteClass(frames) ?? ""}`);
    }
  });
});
