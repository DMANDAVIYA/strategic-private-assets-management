import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DESKTOP_PORT = 7801;
const IPHONE_PORT = 7802;
const HOST = "127.0.0.1";
const SERVER_COMMAND = "npx tsx packages/server/src/cli.ts";
const STATIC_DIR = "apps/web/dist";
const repoRoot = join(import.meta.dirname, "..");
const isCi = Boolean(process.env.CI);

function tempDir(): string {
  const existing = process.env.FP_E2E_TMP;
  if (existing !== undefined && existing !== "") {
    return existing;
  }
  const created = mkdtempSync(join(tmpdir(), "financeper-e2e-"));
  process.env.FP_E2E_TMP = created;
  return created;
}

function serverFor(port: number, dbFile: string) {
  return {
    command: SERVER_COMMAND,
    cwd: repoRoot,
    url: `http://${HOST}:${port}/api/auth/status`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      FP_DB: join(tempDir(), dbFile),
      FP_HOST: HOST,
      FP_PORT: String(port),
      FP_STATIC: STATIC_DIR,
    },
  };
}

const channel = isCi ? undefined : "chrome";
const iphone = devices["iPhone 15"];

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: join(import.meta.dirname, "test-results"),
  globalTeardown: join(import.meta.dirname, "globalTeardown.ts"),
  reporter: [["list"], ["html", { open: "never", outputFolder: join(import.meta.dirname, "playwright-report") }]],
  use: {
    trace: "retain-on-failure",
  },
  webServer: [serverFor(DESKTOP_PORT, "desktop.db"), serverFor(IPHONE_PORT, "iphone.db")],
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel,
        viewport: { width: 1280, height: 820 },
        baseURL: `http://${HOST}:${DESKTOP_PORT}`,
      },
    },
    {
      name: "iphone",
      use: {
        browserName: "chromium",
        channel,
        viewport: iphone.viewport,
        userAgent: iphone.userAgent,
        deviceScaleFactor: iphone.deviceScaleFactor,
        isMobile: iphone.isMobile,
        hasTouch: iphone.hasTouch,
        baseURL: `http://${HOST}:${IPHONE_PORT}`,
      },
    },
  ],
});
