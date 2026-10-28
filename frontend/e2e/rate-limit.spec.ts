// Feature 9, sub-task B — journey 2: initial-load 429 auto-retry.
//
// The first history call returns 429 with Retry-After: 2. The frontend
// shows the "Rate limited — retrying in Ns" banner (1 Hz countdown) and
// waits max(15s base backoff, Retry-After) ≈ 15s before retrying; the
// second call returns the fixture and the pane renders its price.

import { test, expect } from '@playwright/test';
import { buildDailyFixture, fixturePriceText, seededWorkspace } from './fixtures';

// The pane uses a symbol outside the default watchlist so the watchlist's
// own history fetches don't consume the one-shot 429.
const PANE_SYMBOL = 'RLSYM';

test('429 on initial load: banner with countdown, then retry succeeds', async ({ page }) => {
  let paneCalls = 0;
  const fixtureResponse = () => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(buildDailyFixture()),
  });
  page.route('**/api/history/**', (route) => {
    if (route.request().url().includes(`/RLSYM`)) {
      paneCalls += 1;
      if (paneCalls === 1) {
        return route.fulfill({
          status: 429,
          headers: { 'Retry-After': '2' },
          contentType: 'application/json',
          body: JSON.stringify({ error: 'rate limited' }),
        });
      }
    }
    return route.fulfill(fixtureResponse());
  });

  page.addInitScript((ws) => {
    window.localStorage.setItem('stocker.workspace.v1', JSON.stringify(ws));
  }, seededWorkspace([PANE_SYMBOL]));

  await page.goto('/');

  // Banner appears immediately after the 429 (countdown updates at 1 Hz).
  await expect(page.getByText(/Rate limited — retrying in \d+s/)).toBeVisible();

  // Frontend waits ~15s before the first retry; give it a generous window.
  // The watchlist rows show the same fixture price, so scope to the pane.
  await expect(page.locator('div.shadow-xl').first().getByText(fixturePriceText(), { exact: true })).toBeVisible({
    timeout: 45_000,
  });

  // Banner clears once the retry succeeds, and at least one retry happened.
  await expect(page.getByText(/Rate limited — retrying in \d+s/)).toHaveCount(0);
  expect(paneCalls).toBeGreaterThanOrEqual(2);
});
