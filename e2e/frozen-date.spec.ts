import { expect, test } from "@playwright/test";

import { preparePage } from "./helpers";

const FROZEN_ISO = "2026-01-14T12:00:00.000Z";

test.describe("the frozen page date", () => {
  test("keeps Date usable while freezing the current time", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/", { waitUntil: "load" });
    const observed = await page.evaluate(() => ({
      calledWithoutNew: typeof Reflect.apply(Date, undefined, []),
      explicitYear: new Date(2020, 0, 1).getFullYear(),
      instanceCheck: new Date() instanceof Date,
      isoNow: new Date().toISOString(),
      staticNow: new Date(Date.now()).toISOString(),
      utc: Date.UTC(2020, 0, 1),
    }));
    expect(observed).toEqual({
      calledWithoutNew: "string",
      explicitYear: 2020,
      instanceCheck: true,
      isoNow: FROZEN_ISO,
      staticNow: FROZEN_ISO,
      utc: 1_577_836_800_000,
    });
  });
});
