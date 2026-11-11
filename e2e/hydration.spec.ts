import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";
import { ROUTES } from "./routes";

const ALLOWED_ORIGINS = new Set(["https://cloud.umami.is", "https://gateway.umami.is"]);

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  for (const route of ROUTES) {
    test(`${route} hydrates cleanly (${reducedMotion})`, async ({ page, baseURL }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        problems.push(`pageerror: ${error.message}`);
      });
      page.on("requestfailed", (request) => {
        problems.push(`failed: ${request.url()}`);
      });
      page.on("response", (response) => {
        const { origin } = new URL(response.url());
        if (response.status() >= 400) {
          problems.push(`${String(response.status())}: ${response.url()}`);
        }
        if (origin !== baseURL && !ALLOWED_ORIGINS.has(origin)) {
          problems.push(`cross-origin: ${response.url()}`);
        }
      });
      await page.route("**/sounds/manifest.json", (route) =>
        route.fulfill({ json: { sounds: [] } }),
      );
      await preparePage(page, "light");
      await page.emulateMedia({ reducedMotion });
      await page.goto(route);
      await settlePage(page);
      expect(problems).toEqual([]);
    });
  }
}
