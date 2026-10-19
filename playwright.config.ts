import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4319",
    viewport: { width: 1500, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx tests/e2e/server.ts",
    url: "http://127.0.0.1:4319/test/bootstrap",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
