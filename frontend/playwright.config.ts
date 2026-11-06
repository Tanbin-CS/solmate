import { defineConfig, devices } from '@playwright/test'

/**
 * Browser smoke tests: every page of the built app loads, shows its heading, throws no errors and
 * has no serious accessibility violations, on a desktop and a phone profile.
 * Runs against `vite preview` of the production build; set E2E_BASE_URL to test another server
 * (for example the live site after a deploy).
 */
const external = process.env.E2E_BASE_URL
const port = 4173

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  // WebGL pages render in software in headless Chromium; few workers keep each page responsive.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 120_000,
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: external
    ? undefined
    : { command: `npm run preview -- --port ${port} --strictPort`, port, reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
