import { defineConfig } from '@playwright/test';

/**
 * E2E peste UI-ul real, in modul demo local (fara server) — provider-ul
 * in-memory cu date seed (@gr/data demoSeed) e suficient pentru fluxurile
 * cheie (autentificare, creare document), fara sa mai fie nevoie de server/.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -w @gr/ui',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
