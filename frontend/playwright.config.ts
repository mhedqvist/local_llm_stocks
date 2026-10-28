import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config (Feature 9, sub-task B).
 *
 * - Chromium only; tests live in ./e2e.
 * - Two web servers are started (or reused) by the suite:
 *   - the Vite dev server on :5173 (frontend/), and
 *   - the FastAPI backend on :8000 (repo root). The WS endpoint uses the
 *     in-process MockStreamProvider, so no API key is required.
 * - REST history is mocked per-test via page.route; only the WebSocket is
 *   exercised against the real backend.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx vite --port 5173 --strictPort',
      cwd: '.',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
    {
      command: 'python -m uvicorn src.main:app --port 8000',
      cwd: '..',
      url: 'http://localhost:8000/health',
      reuseExistingServer: true,
    },
  ],
});
