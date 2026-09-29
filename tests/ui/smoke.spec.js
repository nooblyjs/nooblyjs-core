/**
 * @fileoverview UI smoke tests: the services dashboard and every service
 * dashboard page load, render their heading, and raise no uncaught
 * JavaScript errors.
 *
 * Run with: npm run test:ui
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const { test, expect } = require('@playwright/test');

/** Service dashboards mounted by app-noauth.js, keyed by URL path segment. */
const SERVICE_PATHS = [
  'logging', 'caching', 'queueing', 'fetching', 'settings',
  'notifying', 'dataservice', 'working', 'measuring',
  'scheduling', 'searching', 'workflow', 'filing',
  'authservice', 'ai'
];

/**
 * Collects uncaught page errors so a test can assert none occurred.
 *
 * @param {import('@playwright/test').Page} page - Page to watch
 * @return {Array<string>} Live list of error messages
 */
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('services dashboard loads', async ({ page }) => {
  const errors = trackPageErrors(page);
  const response = await page.goto('/services/');

  expect(response.status()).toBe(200);
  await expect(page.locator('body')).toContainText(/NooblyJS/i);
  expect(errors).toEqual([]);
});

for (const service of SERVICE_PATHS) {
  test(`${service} dashboard loads without errors`, async ({ page }) => {
    const errors = trackPageErrors(page);
    const response = await page.goto(`/services/${service}/`);

    expect(response.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/.+/);
    expect(errors).toEqual([]);
  });
}
