// Playwright tests for Ghostline. Run: npm install, npx playwright install chromium, npm test
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8000',
    viewport: { width: 1280, height: 720 },
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--use-gl=swiftshader'] } : {},
  },
  webServer: {
    command: process.platform === 'win32' ? 'python -m http.server 8000' : 'python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
  },
});
