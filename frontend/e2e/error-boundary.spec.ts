// Feature 9, sub-task B — journey 3: per-pane error boundary containment.
//
// The workspace is seeded with two panes (MSFT + BROKEN). The first history
// call for BROKEN returns a 200 JSON object instead of an array; the sync
// history-apply effect (sub-task A) then throws `history.map is not a
// function` during React's commit, which the per-pane ErrorBoundary catches.
// The BROKEN pane shows its fallback card while MSFT and the workspace
// header stay interactive. Clicking Retry refetches (now valid) and the
// pane recovers.

import { test, expect } from '@playwright/test';
import { buildDailyFixture, fixturePriceText, seededWorkspace } from './fixtures';

test('malformed history payload is contained by the per-pane error boundary', async ({ page }) => {
  let brokenCalls = 0;
  page.route('**/api/history/**', (route) => {
    const url = route.request().url();
    if (url.includes('/BROKEN')) {
      brokenCalls += 1;
      if (brokenCalls === 1) {
        // Malformed: a JSON object where an array of candles is expected.
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ corrupt: true }),
        });
      }
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDailyFixture()),
    });
  });

  page.addInitScript((ws) => {
    window.localStorage.setItem('stocker.workspace.v1', JSON.stringify(ws));
  }, seededWorkspace(['MSFT', 'BROKEN']));

  await page.goto('/');

  // MSFT pane is healthy; the workspace header still reports two panes.
  // Watchlist rows render the same fixture price; scope to the panes.
  const panePrice = page.locator('div.shadow-xl').getByText(fixturePriceText(), { exact: true });
  const msftPrice = panePrice;
  await expect(msftPrice).toBeVisible();
  await expect(page.getByText('2 panes')).toBeVisible();

  // BROKEN pane: its per-pane boundary caught the render error.
  await expect(page.getByText('BROKEN pane failed to render')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible();

  // Retry remounts the pane; the next BROKEN history call serves the fixture.
  await retry.click();
  await expect(panePrice).toHaveCount(2);
  expect(brokenCalls).toBeGreaterThanOrEqual(2);
});
