// SPDX-License-Identifier: BUSL-1.1
/**
 * Command-palette (Cmd+K / Ctrl+K) e2e tests against the local stack.
 *
 * The header in apps/web/app/(auditor)/shell.tsx renders a "Cmd K" button
 * but it currently has NO onClick handler — the palette overlay isn't
 * shipped yet. Every test in this file is .fixme()'d with a pointed TODO
 * for agent A. They MUST NOT silently pass.
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
  test.fixme('Cmd+K opens overlay; ESC closes it', async ({ page }) => {
    // TODO(agent-A): wire ⌘K / ctrl+K listener + dialog overlay to the
    // header button in apps/web/app/(auditor)/shell.tsx (CommandIcon).
    await page.keyboard.press(`${META}+k`);
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test.fixme('Typing "engagements" navigates to /engagements', async ({ page }) => {
    // TODO(agent-A): palette must surface nav routes as filterable items.
    await page.keyboard.press(`${META}+k`);
    await page.getByRole('combobox', { name: /command/i }).fill('engagements');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/engagements$/, { timeout: 5_000 });
  });

  test.fixme('Typing "raise" surfaces the Raise NC quick action', async ({ page }) => {
    // TODO(agent-A): palette must include "Raise NC" as a quick-action
    // entry that opens the NC modal (which itself doesn't exist yet — see
    // local-stack-workflow.spec.ts test 1).
    await page.keyboard.press(`${META}+k`);
    await page.getByRole('combobox', { name: /command/i }).fill('raise');
    await expect(page.getByRole('option', { name: /Raise NC/i })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /Raise NC|New finding/i })).toBeVisible();
  });

  test.fixme('Typing a library question surfaces a library result', async ({ page }) => {
    // TODO(agent-A): palette must search across the library catalogue and
    // navigate to /library/<entryId> on Enter.
    await page.keyboard.press(`${META}+k`);
    await page.getByRole('combobox', { name: /command/i }).fill('Documented context');
    await expect(page.getByRole('option', { name: /Documented context/i })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/library/, { timeout: 5_000 });
  });

  test.fixme('Header "Cmd K" button click also opens the palette', async ({ page }) => {
    // TODO(agent-A): bind onClick to the header CommandIcon button so it
    // toggles the palette dialog; today it is a static <button> with no
    // handler attached.
    await page.getByRole('button', { name: /Open command palette/i }).click();
    await expect(page.getByRole('dialog', { name: /command/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test.fixme('Palette is keyboard-navigable end-to-end', async ({ page }) => {
    // TODO(agent-A): palette options must be reachable via Arrow keys with
    // Enter activating the focused option.
    await page.keyboard.press(`${META}+k`);
    await page.getByRole('combobox', { name: /command/i }).fill('eng');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/engagements/, { timeout: 5_000 });
  });

  test.fixme('Palette traps focus while open', async ({ page }) => {
    // TODO(agent-A): Tab / Shift+Tab must cycle inside the dialog only.
    await page.keyboard.press(`${META}+k`);
    const dialog = page.getByRole('dialog', { name: /command/i });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 10; i += 1) await page.keyboard.press('Tab');
    const focusInsideDialog = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg?.contains(document.activeElement) ?? false;
    });
    expect(focusInsideDialog, 'focus should remain inside the palette dialog').toBe(true);
    for (let i = 0; i < 10; i += 1) await page.keyboard.press('Shift+Tab');
    const focusStillInside = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg?.contains(document.activeElement) ?? false;
    });
    expect(focusStillInside, 'Shift+Tab must also stay inside the palette').toBe(true);
  });
});
