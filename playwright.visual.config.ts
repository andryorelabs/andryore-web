import { defineConfig, devices } from "@playwright/test";

const PORT = "4417";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /visual\.spec\.ts/,
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `${process.env.PLAYWRIGHT_PREVIEW_COMMAND ?? "bun run preview"} --host 127.0.0.1 --port ${PORT} --ignore-lock`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
