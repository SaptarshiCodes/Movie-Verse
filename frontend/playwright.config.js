import { defineConfig, devices } from "@playwright/test";

const appPort = 3100;
const fixturePort = 3101;
const baseURL = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/tmdb-fixture-server.js",
      url: `http://127.0.0.1:${fixturePort}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { PORT: String(fixturePort) },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        TMDB_API_KEY: "playwright-fixture-key",
        TMDB_BASE_URL: `http://127.0.0.1:${fixturePort}/3`,
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
  ],
});
