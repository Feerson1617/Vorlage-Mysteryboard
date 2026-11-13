import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/release",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-rc2", open: "never" }],
    ["json", { outputFile: "test-results-rc2/results.json" }],
  ],
  outputDir: "test-results-rc2/run",
  use: {
    browserName: "chromium",
    headless: true,
    hasTouch: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    acceptDownloads: true,
    screenshot: "only-on-failure",
  },
});
