import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/perf',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: [] },
  },
  projects: [
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
});
