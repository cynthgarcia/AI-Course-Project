import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}`,
    // Use a preinstalled Chromium when provided (e.g. CI images); otherwise Playwright's own.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        port,
        reuseExistingServer: true,
        timeout: 60_000,
        env: { DATA_DIR: "memory://", SIGNUP_RATE_LIMIT: "1000", NEXT_TELEMETRY_DISABLED: "1" },
      },
});
