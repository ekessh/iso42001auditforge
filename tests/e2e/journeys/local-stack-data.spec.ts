// SPDX-License-Identifier: BUSL-1.1
/**
 * List / filter / sort verification against the local stack.
 *
 * Library page already ships a working search + kind filter; the
 * corresponding tests run live. Findings + Engagements pages have no
 * filter / sort UI yet, so those tests are .fixme()'d with TODOs for
 * agent A. The clients-stress test mirrors the pattern from
 * local-stack-edge.spec.ts (200-item mock route).
 */
import { expect, test } from '@playwright/test';
import {
  EngagementsPage,
  FindingsPage,
  LibraryPage,
  LoginPage,
} from '../helpers/auditor-page-objects';
import { waitForStack } from '../helpers/wait-for-stack';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

test.beforeAll(async () => {
  await waitForStack({ webUrl: BASE, apiUrl: API, timeoutMs: 30_000 });
});

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await context.clearPermissions();
  const login = new LoginPage(page);
  await login.signInStub();
});

test.describe('List, filter, sort @workflow @smoke', () => {
  test('Findings filter by severity narrows results', async ({ page }) => {
    const findings = new FindingsPage(page);
    await findings.goto();
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /AIMS scope statement|Risk register|Model card/i }).first()).toBeVisible({ timeout: 10_000 });
    await findings.filterBySeverity('major_nc');
    await expect(main.getByRole('link', { name: /AIMS scope statement out of date/i })).toBeVisible();
    await expect(main.getByRole('link', { name: /Risk register lacks/i })).toHaveCount(0);
  });

  test('Findings filter by status narrows results', async ({ page }) => {
    const findings = new FindingsPage(page);
    await findings.goto();
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /AIMS scope statement|Risk register|Model card/i }).first()).toBeVisible({ timeout: 10_000 });
    await findings.filterByStatus('open');
    const rows = main.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Library filter by kind (iso42001_clause) only shows clauses', async ({ page }) => {
    const library = new LibraryPage(page);
    await library.goto();
    await library.filterByKind('iso42001_clause');
    const list = page.getByRole('main').locator('ul > li');
    await expect(list.first()).toBeVisible({ timeout: 10_000 });
    const count = await list.count();
    expect(count, 'filter should narrow library to clause-kind rows only').toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(
        list.nth(i).getByText(/^Question$/),
        `row ${i} must not be a "Question" badge under kind=iso42001_clause`,
      ).toHaveCount(0);
      await expect(list.nth(i).getByText('ISO 42001')).toBeVisible();
    }
  });

  test('Library search box narrows results', async ({ page }) => {
    const library = new LibraryPage(page);
    await library.goto();
    await library.search('context');
    const main = page.getByRole('main');
    await expect(main.getByText(/Documented context/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByText(/AI-specific risk identification/i)).toHaveCount(0);
  });

  test('Engagements page renders three seeded engagements', async ({ page }) => {
    const engagements = new EngagementsPage(page);
    await engagements.goto();
    await expect(page.getByRole('main').getByText(/AIMS covering clinical/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('main').getByText(/AIMS for trading model/i)).toBeVisible();
    await expect(page.getByRole('main').getByText(/Readiness audit for AIMS/i)).toBeVisible();
  });

  test('Clients list with 200 mocked items renders + first/last visible', async ({ context, page }) => {
    await context.route(`${API}/v1/clients*`, async (route) => {
      const items = Array.from({ length: 200 }, (_, i) => ({
        id: `cli-${String(i).padStart(3, '0')}`,
        firmId: 'firm-001',
        name: `Stress Client ${i}`,
        metadata: { idx: i },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, nextCursor: null, prevCursor: null }),
      });
    });
    await page.goto(`${BASE}/clients`);
    await expect(page).toHaveURL(/\/clients$/);
    const main = page.getByRole('main');
    await expect(main.getByText('Stress Client 0').first()).toBeVisible({ timeout: 15_000 });
    await main.getByText('Stress Client 199').first().scrollIntoViewIfNeeded();
    await expect(main.getByText('Stress Client 199').first()).toBeVisible();
  });
});
