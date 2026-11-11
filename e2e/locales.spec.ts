import { expect, test } from "@playwright/test";

import { chromeMessages } from "./messages";

const CASES = [
  { browserLocale: "es-ES", route: "/", language: "en" },
  { browserLocale: "en-US", route: "/es/", language: "es" },
] as const;

for (const { browserLocale, route, language } of CASES) {
  test.describe(`browser language ${browserLocale}`, () => {
    test.use({
      locale: browserLocale,
      extraHTTPHeaders: { "Accept-Language": browserLocale },
    });

    test(`${route} stays put and renders in ${language}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL((url) => url.pathname === route);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.getByRole("link", { name: chromeMessages(language).skipLink })).toHaveCount(
        1,
      );
    });
  });
}
