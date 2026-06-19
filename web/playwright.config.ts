import { defineConfig, devices } from '@playwright/test'

const repoRoot = '..'
const qaSecret = process.env.QA_AUTH_SECRET || 'playwright-qa-secret'
const qaAccounts =
  'qa-loss|qa-loss@example.test|QA Loss,' +
  'qa-gain|qa-gain@example.test|QA Gain,' +
  'qa-sporadic|qa-sporadic@example.test|QA Sporadic'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'uv run uvicorn app.main:app --host 127.0.0.1 --port 8010',
      cwd: repoRoot,
      url: 'http://127.0.0.1:8010/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        QA_AUTH_ENABLED: 'true',
        QA_AUTH_SECRET: qaSecret,
        QA_AUTH_ACCOUNTS: qaAccounts,
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_PROXY_API_TARGET: 'http://127.0.0.1:8010',
      },
    },
  ],
})
