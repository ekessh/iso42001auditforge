// SPDX-License-Identifier: BUSL-1.1
/**
 * Lead-Auditor narrative tests — verifies that the ship-ready affordances
 * are present and reachable. Deep multi-step CRUD coverage lives in the
 * higher-fidelity Docker-stack journey suite under tests/e2e/journeys/journey-*.
 */
import { expect, test } from '@playwright/test';
import {
  DashboardPage,
  EngagementDetailPage,
  FindingsPage,
  LoginPage,
  SettingsPage,
} from '../helpers/auditor-page-objects';
import { waitForStack } from '../helpers/wait-for-stack';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

test.beforeAll(async () => {
  await waitForStack({ webUrl: BASE, apiUrl: API, timeoutMs: 30_000 });
});

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.clearPermissions();
});

test.describe('Local-stack workflow @workflow @smoke', () => {
  test('Dashboard quick actions open modals', async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.signInStub();
    await dashboard.clickQuickAction('Start new engagement');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');

    await dashboard.clickQuickAction('Run probe');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');

    await dashboard.clickQuickAction('Raise NC');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('Engagement detail — every tab renders panel content', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);

    for (const t of ['Overview', 'Plan', 'Working Papers', 'Findings', 'Probes', 'Traces', 'Report', 'Audit Trail']) {
      await detail.clickTab(t);
      await expect(page.getByRole('tabpanel', { name: t })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Engagement Findings tab exposes Raise NC affordance', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);
    await detail.clickTab('Findings');
    await expect(page.getByRole('button', { name: /Raise NC/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Engagement Probes tab exposes Run probe affordance', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);
    await detail.clickTab('Probes');
    await expect(page.getByRole('button', { name: /Run probe/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Engagement Traces tab exposes Upload trace affordance', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);
    await detail.clickTab('Traces');
    await expect(page.getByRole('button', { name: /Upload trace/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Engagement Report tab renders generate-draft action', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);
    await detail.clickTab('Report');
    await expect(page.getByRole('button', { name: /Generate.*draft/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Engagement Audit Trail tab renders panel content', async ({ page }) => {
    const login = new LoginPage(page);
    const detail = new EngagementDetailPage(page);

    await login.signInStub();
    await page.goto(`${BASE}/engagements/eng-001`);
    await detail.clickTab('Audit Trail');
    const panel = page.getByRole('tabpanel', { name: 'Audit Trail' });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/hash.chain|Ed25519|ledger|event|signed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Findings list — Raise NC button visible', async ({ page }) => {
    const login = new LoginPage(page);
    const findings = new FindingsPage(page);

    await login.signInStub();
    await findings.goto();
    await expect(page.getByRole('button', { name: /Raise NC/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Sign-out clears local state', async ({ page }) => {
    const login = new LoginPage(page);
    const settings = new SettingsPage(page);

    await login.signInStub();
    await settings.goto();
    await settings.expectAuditor('M. Castellanos');
    await settings.signOut();

    await page.goto(`${BASE}/dashboard`);
    await expect(page.getByText('Not signed in')).toBeVisible({ timeout: 10_000 });
  });
});
