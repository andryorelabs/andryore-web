import { expect, test } from "@playwright/test";

import { preparePage, settlePage } from "./helpers";

const ENGLISH_CV = "/cv/andry-orellana-cv-en.pdf";
const SPANISH_CV = "/cv/andry-orellana-cv-es.pdf";

test.describe("about CV split button", () => {
  test("lists both PDFs and keeps the chosen language after a reload", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/about/");
    await settlePage(page);
    const download = page.locator("[data-cv-download]");
    await expect(download).toHaveAttribute("href", ENGLISH_CV);

    await page.locator("[data-cv-menu-trigger]").click();
    const english = page.getByRole("menuitemradio", { name: "English (PDF)" });
    const spanish = page.getByRole("menuitemradio", { name: "Spanish (PDF)" });
    await expect(english).toBeVisible();
    await expect(spanish).toBeVisible();

    await spanish.click();
    await expect(download).toHaveAttribute("href", SPANISH_CV);

    await page.reload();
    await settlePage(page);
    await expect(download).toHaveAttribute("href", SPANISH_CV);
  });

  test("the Spanish page starts with the Spanish CV", async ({ page }) => {
    await preparePage(page, "light");
    await page.goto("/es/about/");
    await settlePage(page);
    await expect(page.locator("[data-cv-download]")).toHaveAttribute("href", SPANISH_CV);
  });
});

test.describe("about and uses back link", () => {
  const cases = [
    { path: "/about/", home: "/", label: "←Home" },
    { path: "/uses/", home: "/", label: "←Home" },
    { path: "/es/about/", home: "/es/", label: "←Inicio" },
    { path: "/es/uses/", home: "/es/", label: "←Inicio" },
  ];

  for (const { path, home, label } of cases) {
    test(`${path} links back to ${home}`, async ({ page }) => {
      await preparePage(page, "light");
      await page.goto(path);
      await settlePage(page);
      const back = page.locator("[data-page-back]");
      await expect(back).toBeVisible();
      await expect(back).toHaveText(label);
      await expect(back).toHaveAttribute("href", home);
      await back.focus();
      await expect(back).toBeFocused();
    });
  }
});

test.describe("about typing headline", () => {
  test("flows inline after the prefix on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preparePage(page, "light");
    await page.goto("/about/");
    await settlePage(page);
    const heading = await page.locator("#about-heading").boundingBox();
    const text = await page.locator("#about-heading [data-typing-text]").boundingBox();
    expect(heading).not.toBeNull();
    expect(text).not.toBeNull();
    expect((text?.y ?? 0) - (heading?.y ?? 0)).toBeLessThan(10);
  });
});
