import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  timeout: 90000,
  workers: 1,
  use: { baseURL: "http://localhost:4320", trace: "retain-on-failure" },
  webServer: {
    command: "node tests/browser-server.mjs",
    url: "http://localhost:4320/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: "list",
});
