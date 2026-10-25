import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, workers: 2, fullyParallel: false,
  outputDir: 'artifacts/cardspec-qa/test-results',
  reporter: [['list'], ['json', { outputFile: 'artifacts/cardspec-qa/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:8790', viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: { command: 'node tests/fixture-server.mjs', url: 'http://127.0.0.1:8790/api/health', timeout: 15000, reuseExistingServer: false },
})
