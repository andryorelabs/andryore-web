import { expect, test } from "@playwright/test";

import { ROUTES } from "./routes";

test("every internal link answers 200 with no redirect", async ({ page, request }) => {
  const targets = new Set<string>();
  for (const route of ROUTES) {
    await page.goto(route);
    const hrefs = await page.$$eval('a[href^="/"]', (anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) targets.add(href.split("#", 1)[0] ?? href);
  }
  expect(targets.size).toBeGreaterThan(ROUTES.length);
  for (const target of targets) {
    const response = await request.get(target, { maxRedirects: 0 });
    expect(response.status(), target).toBe(200);
  }
});
