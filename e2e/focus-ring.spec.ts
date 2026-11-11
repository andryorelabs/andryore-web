import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";
import { THEMES } from "./routes";

const MINIMUM_CONTRAST = 3;

for (const theme of THEMES) {
  for (const route of ["/", "/es/"]) {
    test(`focus ring on ${route} has 3:1 contrast in ${theme}`, async ({ page }) => {
      await preparePage(page, theme);
      await page.goto(route);
      await settlePage(page);
      await page.keyboard.press("Tab");
      const measured = await page.evaluate(() => {
        const context = globalThis.document
          .createElement("canvas")
          .getContext("2d", { willReadFrequently: true });
        if (!context) return;

        const toRgba = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return context.getImageData(0, 0, 1, 1).data;
        };

        const luminance = (color: string) => {
          const [red = 0, green = 0, blue = 0] = toRgba(color);
          const linear = [red, green, blue].map((channel) => {
            const scaled = channel / 255;
            return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
        };
        const focused = globalThis.document.activeElement;
        if (!focused) return;
        const style = globalThis.getComputedStyle(focused);
        let surface: Element | null = focused.parentElement;
        let background = "transparent";
        while (surface && toRgba(background)[3] === 0) {
          background = globalThis.getComputedStyle(surface).backgroundColor;
          surface = surface.parentElement;
        }
        const ring = luminance(style.outlineColor);
        const behind = luminance(background);
        return {
          width: Number(style.outlineWidth.replace("px", "")),
          outlineStyle: style.outlineStyle,
          ratio: (Math.max(ring, behind) + 0.05) / (Math.min(ring, behind) + 0.05),
        };
      });
      expect(measured).toBeDefined();
      expect(measured?.outlineStyle).not.toBe("none");
      expect(measured?.width).toBeGreaterThan(0);
      expect(measured?.ratio).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
    });
  }
}
