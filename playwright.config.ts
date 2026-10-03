import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Sunucu ve istemci ayrı sağlık kontrolleriyle: biri hazır değilken testler başlamaz.
  webServer: [
    {
      command: 'pnpm --filter @gg/server dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
    },
    {
      command: 'pnpm --filter @gg/client dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
    },
  ],
});
