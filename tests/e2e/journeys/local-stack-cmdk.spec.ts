// SPDX-License-Identifier: BUSL-1.1
/**
 * Command-palette (Cmd+K / Ctrl+K) e2e tests against the local stack.
 * Verifies: hotkey opens overlay, ESC closes, header button opens, items
 * are filterable, focus is trapped while open.
 */
import { expect, test } from '@playwright/test';
import { LoginPage } from '../helpers/auditor-page-objects';
import { waitForStack } from '../helpers/wait-for-stack';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';
const isMac = process.platform === 'darwin';
const META = isMac ? 'Meta' : 'Control';

test.beforeAll(async () => {
  await waitForStack({ webUrl: BASE, apiUrl: API, timeoutMs: 30_000 });
});

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await context.clearPermissions();
  const login = new LoginPage(page);
  await login.signInStub();
});

test.describe('Command palette @workflow @smoke', () => {
  test('Cmd+K opens overlay; ESC closes it', async ({ page }) => {
    await page.keyboard.press(`${META}+k`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('Header "Cmd K" button click also opens the palette', async ({ page }) => {
    await page.getByRole('button', { name: /Open command palette/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('Typing filters the palette options', async ({ page }) => {
    await page.keyboard.press(`${META}+k`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const input = dialog.locator('input').first();
    await input.fill('engagement');
    await expect(dialog.getByText(/engagement/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Palette traps focus while open', async ({ page }) => {
    await page.keyboard.press(`${META}+k`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
    const focusInside = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg?.contains(document.activeElement) ?? false;
    });
    expect(focusInside, 'focus should remain inside the palette dialog').toBe(true);
  });
});
