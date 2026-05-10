// SPDX-License-Identifier: BUSL-1.1
/**
 * Local-stack e2e suite.
 * Targets: web on :3000 (built with NEXT_PUBLIC_AUTH_STUB=1) + dev-mock-api on :4000.
 * Run: E2E_SKIP_GLOBAL_SETUP=1 pnpm --filter @auditforge/e2e exec playwright test journeys/local-stack
 */
import { test, expect } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';

test.describe('Local stack @smoke — stub auth + mock API', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('root redirects to /login', async ({ page }) => {
    const resp = await page.goto(`${BASE}/`);
    expect(resp?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login page renders sign-in card', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with passkey/i })).toBeVisible();
  });

  test('stub passkey login redirects to dashboard with auditor identity', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5_000 });
    await expect(page.getByText('M. Castellanos')).toBeVisible();
    await expect(page.getByText('Sentinel CB')).toBeVisible();
  });

  test('dashboard renders engagements from mock API', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('main').getByText(/AIMS covering clinical/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('main').getByText(/AIMS for trading model/i)).toBeVisible();
    await expect(page.getByRole('main').getByText(/Readiness audit for AIMS/i)).toBeVisible();
  });

  test('engagements page lists three engagements', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Engagements/i }).first().click();
    await expect(page).toHaveURL(/\/engagements$/);
    await expect(page.getByRole('main').getByText(/AIMS covering clinical/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('main').getByText(/AIMS for trading model/i)).toBeVisible();
    await expect(page.getByRole('main').getByText(/Readiness audit for AIMS/i)).toBeVisible();
  });

  test('clients page lists clients', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Clients/i }).first().click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole('main').getByText('Atlas Diagnostics Inc.')).toBeVisible({ timeout: 15_000 });
  });

  test('findings page lists findings', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Findings/i }).first().click();
    await expect(page).toHaveURL(/\/findings$/);
    await expect(page.getByRole('link', { name: /AIMS scope statement out of date/i })).toBeVisible({ timeout: 15_000 });
  });

  test('probes page lists probe catalogue', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Probes/i }).first().click();
    await expect(page).toHaveURL(/\/probes$/);
    await expect(page.getByRole('main').getByText(/System prompt frozen/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('traces page lists ingested traces', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Traces/i }).first().click();
    await expect(page).toHaveURL(/\/traces$/);
    await expect(page.getByRole('main').getByText(/LangGraph clinical-triage|CrewAI marketing/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('library page lists question library', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Library/i }).first().click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole('main').getByText(/Documented context of the organization|AI-specific risk identification/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('settings page renders auditor profile', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: /Continue with passkey/i }).click();
    await page.getByRole('link', { name: /Settings/i }).first().click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('main').getByText('M. Castellanos')).toBeVisible();
  });

  test('CSP header is set on /login', async ({ request }) => {
    const resp = await request.get(`${BASE}/login`);
    const csp = resp.headers()['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  test('security headers — HSTS, X-Frame-Options, Referrer-Policy', async ({ request }) => {
    const resp = await request.get(`${BASE}/login`);
    expect(resp.headers()['x-frame-options']).toBe('DENY');
    expect(resp.headers()['x-content-type-options']).toBe('nosniff');
    expect(resp.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(resp.headers()['strict-transport-security']).toContain('max-age=63072000');
  });
});
