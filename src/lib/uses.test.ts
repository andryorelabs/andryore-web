import { describe, expect, test } from "bun:test";

import { ICONS, type IconId } from "./icons";
import {
  ALT_BADGES,
  BADGE_COLORS,
  badgeIconId,
  badgeStyle,
  FIELD_ICONS,
  floatClass,
  SETUP_GLYPHS,
  SWATCH_TOKENS,
} from "./uses";

const luminance = (hex: string): number => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const unit = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

describe("FIELD_ICONS", () => {
  test("holds the eight canvas icons in order with their positions", () => {
    expect(FIELD_ICONS.map((icon) => icon.id)).toEqual([
      "typescript",
      "bun",
      "astro",
      "react",
      "nextjs",
      "tailwindcss",
      "claude",
      "docker",
    ]);
    expect(FIELD_ICONS.map((icon) => icon.placement)).toEqual([
      "left-[8%] top-[12%] size-[84px] max-[639px]:top-4 max-[639px]:left-[6%] max-[639px]:size-11",
      "left-[20%] top-[62%] size-[64px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[6%] max-[639px]:size-11",
      "left-[30%] top-[18%] size-[72px] max-[639px]:top-4 max-[639px]:left-[28%] max-[639px]:size-11",
      "left-[44%] top-[70%] size-[96px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[28%] max-[639px]:size-12",
      "left-[58%] top-[8%] size-[60px] max-[639px]:top-4 max-[639px]:left-[50%] max-[639px]:size-11",
      "left-[66%] top-[66%] size-[72px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[50%] max-[639px]:size-11",
      "left-[78%] top-[20%] size-[84px] max-[639px]:top-4 max-[639px]:left-[72%] max-[639px]:size-12",
      "left-[88%] top-[58%] size-[64px] max-[639px]:top-auto max-[639px]:bottom-4 max-[639px]:left-[72%] max-[639px]:size-11",
    ]);
    for (const icon of FIELD_ICONS) expect(Object.hasOwn(ICONS, icon.id)).toBe(true);
  });
});

describe("floatClass", () => {
  test("cycles through floats that last 6 to 8 seconds", () => {
    expect(floatClass(0)).toBe("uses-float-6");
    expect(floatClass(1)).toBe("uses-float-7");
    expect(floatClass(2)).toBe("uses-float-8");
    expect(floatClass(3)).toBe("uses-float-6");
  });

  test("treats a negative index as the first float", () => {
    expect(floatClass(-4)).toBe("uses-float-6");
  });
});

describe("badgeStyle", () => {
  test("uses a white logo and name on a dark brand", () => {
    const style = badgeStyle("coolify");
    expect(style.text).toBe("text-white");
    expect(style.logo).toContain("invert");
  });

  test("uses near-black text on a light brand", () => {
    const style = badgeStyle("react");
    expect(style.text).toBe("text-[#111111]");
    expect(style.logo).not.toContain("invert");
  });

  test("sets the canvas colours for the changed brands", () => {
    expect(badgeStyle("starship").hex).toBe("#dd0b78");
    expect(badgeStyle("github").hex).toBe("#181717");
    expect(badgeStyle("git").hex).toBe("#da372a");
    expect(badgeStyle("bun").hex).toBe("#000000");
    expect(badgeStyle("zod").hex).toBe("#408aff");
    expect(badgeStyle("posthog").hex).toBe("#000000");
  });

  test("keeps white text on every light-ink brand at WCAG AA contrast", () => {
    for (const id of Object.keys(BADGE_COLORS) as IconId[]) {
      const style = badgeStyle(id);
      if (style.text !== "text-white") continue;
      expect(1.05 / (luminance(style.hex) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("gives the alt brands a grey badge and a full-colour logo", () => {
    for (const id of ALT_BADGES) {
      const style = badgeStyle(id);
      expect(style.bg).toBe("bg-[#eef0f4]");
      expect(style.text).toBe("text-[#15191f]");
      expect(style.logo).toBe("");
    }
    expect([...ALT_BADGES].toSorted((a, b) => a.localeCompare(b))).toEqual([
      "base-ui",
      "chezmoi",
      "mise",
      "orca",
      "remotion",
      "trigger-dev",
    ]);
  });

  test("every coloured badge class names its hex", () => {
    for (const id of Object.keys(BADGE_COLORS) as IconId[]) {
      const style = badgeStyle(id);
      expect(style.bg).toBe(`bg-[${style.hex}]`);
    }
  });

  test("rejects an icon without a badge colour", () => {
    expect(() => badgeStyle("twitch")).toThrow();
  });
});

describe("badgeIconId", () => {
  test("returns a known id and throws on an unknown one", () => {
    expect(badgeIconId("bun")).toBe("bun");
    expect(() => badgeIconId("nope")).toThrow();
  });
});

describe("tables", () => {
  test("holds six colour swatches and the seven setup glyphs", () => {
    expect(SWATCH_TOKENS).toHaveLength(6);
    expect(SETUP_GLYPHS).toEqual([
      "laptop",
      "mic",
      "camera",
      "mouse",
      "keyboard",
      "usb",
      "headphones",
    ]);
  });
});
