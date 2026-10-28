// Feature 9, sub-task B — journey 1: workspace usability.
//
// Loads the app with mocked REST history (deterministic fixture) against the
// real backend WS, then exercises pane CRUD, an indicator toggle, and
// symbol persistence across a reload.

import { test, expect } from '@playwright/test';
import { buildDailyFixture, fixturePriceText } from './fixtures';

const panes = (page: import('@playwright/test').Page) => page.locator('div.shadow-xl');

test('workspace journeys: load, toggle, add/close pane, persist symbol', async ({ page }) => {
  page.route('**/api/history/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDailyFixture()),
    })
  );

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');

  // 1. Default pane loads the fixture; real backend marks the pane Live.
  await expect(panes(page)).toHaveCount(1);
  const first = panes(page).first();
  await expect(first.getByText(fixturePriceText(), { exact: true })).toBeVisible();
  await expect(first.getByText('Live')).toBeVisible();

  // 2. Toggle SMA on, then off again: the enabled class flips both ways,
  //  the pane keeps rendering (no per-pane error boundary), and no console
  //  errors (regression: deselecting used to hit chart.removeSeries with a
  //  stale series handle after a chart rebuild).
  const sma = first.getByRole('button', { name: 'SMA', exact: true });
  await expect(sma).not.toHaveClass(/bg-emerald-700/);
  await sma.click();
  await expect(sma).toHaveClass(/bg-emerald-700/);
  await sma.click();
  await expect(sma).not.toHaveClass(/bg-emerald-700/);
  await expect(first.getByText(fixturePriceText(), { exact: true })).toBeVisible();
  await expect(first.getByText(/failed to render/)).toHaveCount(0);

  // 3. Add a pane: the second pane renders its own fixture price.
  await page.getByRole('button', { name: '+ Add pane' }).click();
  await expect(panes(page)).toHaveCount(2);
  await expect(panes(page).nth(1).getByText(fixturePriceText(), { exact: true })).toBeVisible();

  // 4. Close the second pane: back to one.
  await panes(page).nth(1).getByRole('button', { name: 'Remove pane' }).click();
  await expect(panes(page)).toHaveCount(1);

  // 5. Symbol change persists across reload (stocker.workspace.v1).
  const input = panes(page).first().getByLabel(/Symbol for pane /);
  await input.fill('MSFT');
  await input.press('Enter');
  await page.reload();
  await expect(panes(page).first().getByLabel(/Symbol for pane /)).toHaveValue('MSFT');
  await expect(
    panes(page).first().getByText(fixturePriceText(), { exact: true })
  ).toBeVisible();

  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
