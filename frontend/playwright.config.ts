import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// O processo principal continua vivo depois que o Playwright encerra os serviços no Windows.
const pasta = join(tmpdir(), "siproquim-ui-test-" + randomUUID());
export default defineConfig({
  reporter: [["list"], ["./tests/limpeza.ts", { pasta }]],
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:15173",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    env: { SIPROQUIM_UI_PASTA: pasta },
    command: "node tests/servidor.mjs",
    url: "http://127.0.0.1:15173",
    reuseExistingServer: false,
    timeout: 75000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
