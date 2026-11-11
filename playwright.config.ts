import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "4417";
const LAYOUT_SPEC = /layout\.spec\.ts/;
const MOBILE_SPECS = /(layout|overflow|landscape|theme-tile-orientation)\.spec\.ts/;
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: /visual\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ["html", { open: "never" }],
        ["json", { outputFile: "test-results/report.json" }],
      ]
    : "list",
  use: { baseURL: EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PORT}` },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit",
      testMatch: LAYOUT_SPEC,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "firefox",
      testMatch: LAYOUT_SPEC,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "mobile-android",
      testMatch: MOBILE_SPECS,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-ios",
      testMatch: MOBILE_SPECS,
      use: { ...devices["iPhone 14"], defaultBrowserType: "chromium" },
    },
  ],
  ...(!EXTERNAL_BASE_URL && {
    webServer: {
      command: `${process.env.PLAYWRIGHT_PREVIEW_COMMAND ?? "bun run preview"} --host 127.0.0.1 --port ${PORT} --ignore-lock`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  }),
});
