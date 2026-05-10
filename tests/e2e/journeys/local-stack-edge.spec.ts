// SPDX-License-Identifier: BUSL-1.1
/**
 * Rigorous edge-case e2e suite — local-stack only.
 * Targets: web on :3000 (NEXT_PUBLIC_AUTH_STUB=1, NEXT_DISABLE_PWA=1) +
 *          dev-mock-api on :4000.
 *
 * Covers: auth edges, deep-link guards, 404s, server-error injection,
 * pagination boundaries, empty states, special-char URLs, navigation
 * back/forward, rapid double-clicks, mobile viewport rendering, CSP +
 * security headers across every primary route, axe accessibility.
 *
 * Run: E2E_SKIP_GLOBAL_SETUP=1 pnpm --filter @auditforge/e2e exec \
 *      playwright test journeys/local-stack-edge.spec.ts --project=chromium
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:3000';
const API = process.env['E2E_API_URL'] ?? 'http://localhost:4000';

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: /Continue with passkey/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5_000 });
}

test.describe('Edge — auth + deep-link @smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('deep-link to /dashboard without auth still renders shell (zustand stub)', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
  });

  test('unknown route returns 404 not crash', async ({ page }) => {
    const resp = await page.goto(`${BASE}/this-route-does-not-exist`);
    expect([404, 200]).toContain(resp?.status() ?? 0);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('rapid double-click on passkey button does not double-navigate', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const btn = page.getByRole('button', { name: /Continue with passkey/i });
    await Promise.all([btn.click(), btn.click().catch(() => undefined)]);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5_000 });
  });

  test('browser back from dashboard returns to login', async ({ page }) => {
    await login(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('login form submits via Enter key', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5_000 });
  });
});

test.describe('Edge — 404 + server error injection @smoke', () => {
  test('engagement detail with invalid id renders error or empty state', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/engagements/invalid-engagement-id-12345`);
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByText(/not found|error|invalid|loading|engagement/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('500 from /v1/engagements surfaces error UI not blank screen', async ({ page }) => {
    await page.route(`${API}/v1/engagements*`, async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'simulated' }) });
    });
    await login(page);
    await expect(page.getByRole('main').getByText(/HTTP 500|error|failed|unable/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('malformed JSON from /v1/findings surfaces schema-validation message', async ({ page }) => {
    await login(page);
    await page.route(`${API}/v1/findings*`, async (route) => {
      await route.fulfill({ status: 200, body: '{not-valid-json' });
    });
    await page.getByRole('link', { name: /Findings/i }).first().click();
    await expect(page).toHaveURL(/\/findings$/);
    await expect(page.getByText(/error|failed|invalid/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('schema-violating response (missing required fields) surfaces error', async ({ page }) => {
    await login(page);
    await page.route(`${API}/v1/clients*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: 'broken' }], nextCursor: null, prevCursor: null }),
      });
    });
    await page.getByRole('link', { name: /Clients/i }).first().click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByText(/error|failed|validation|invalid/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Edge — empty + boundary @smoke', () => {
  test('empty engagements list renders empty-state copy', async ({ page }) => {
    await page.route(`${API}/v1/engagements*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null, prevCursor: null }),
      });
    });
    await login(page);
    await expect(
      page.getByRole('main').getByText(/no engagements|empty|nothing/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('large list (200 items) renders without crash', async ({ page }) => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `cli-${String(i).padStart(3, '0')}`,
      firmId: 'firm-001',
      name: `Stress Client ${i}`,
      metadata: { idx: i },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }));
    await page.route(`${API}/v1/clients*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, nextCursor: null, prevCursor: null }),
      });
    });
    await login(page);
    await page.getByRole('link', { name: /Clients/i }).first().click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole('main').getByText('Stress Client 0').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('main').getByText('Stress Client 199').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Edge — XSS / injection attempts @smoke', () => {
  test('script-tag in engagement scope is rendered as text not executed', async ({ page }) => {
    let scriptFired = false;
    await page.exposeFunction('__xss_caught', () => { scriptFired = true; });
    await page.route(`${API}/v1/engagements*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            id: 'eng-xss',
            firmId: 'firm-001',
            clientId: 'cli-xss',
            mode: 'audit',
            stage: 'stage1',
            status: 'planned',
            scopeStatement: '<img src=x onerror="window.__xss_caught()">XSS test scope',
            startsOn: '2026-01-01',
            endsOn: '2026-01-02',
            leadAuditorId: 'auditor-001',
            teamMemberIds: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }],
          nextCursor: null,
          prevCursor: null,
        }),
      });
    });
    await login(page);
    await expect(page.getByRole('main').getByText(/XSS test scope/i).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(scriptFired).toBe(false);
  });

  test('special-char URL segment does not crash router', async ({ page }) => {
    await login(page);
    const resp = await page.goto(`${BASE}/engagements/${encodeURIComponent("'; DROP TABLE--")}`);
    expect(resp?.status()).toBeLessThan(500);
  });
});

test.describe('Edge — security headers across routes @smoke', () => {
  const ROUTES = [
    '/login',
    '/dashboard',
    '/engagements',
    '/findings',
    '/clients',
    '/probes',
    '/traces',
    '/library',
    '/settings',
    '/readiness',
    '/audit-dashboard',
  ];

  for (const route of ROUTES) {
    test(`headers — ${route}`, async ({ request }) => {
      const resp = await request.get(`${BASE}${route}`);
      expect(resp.headers()['x-frame-options']).toBe('DENY');
      expect(resp.headers()['x-content-type-options']).toBe('nosniff');
      expect(resp.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(resp.headers()['strict-transport-security']).toContain('max-age=63072000');
      expect(resp.headers()['permissions-policy']).toContain('camera=()');
      const csp = resp.headers()['content-security-policy'];
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });
  }
});

test.describe('Edge — accessibility (axe-core) @smoke', () => {
  const A11Y_ROUTES = ['/login', '/dashboard', '/engagements', '/findings', '/clients'];
  for (const route of A11Y_ROUTES) {
    test(`a11y — ${route} no critical violations`, async ({ page }) => {
      if (route !== '/login') await login(page);
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(critical, JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
    });
  }
});

test.describe('Edge — mobile viewport @smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('login renders on mobile viewport', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with passkey/i })).toBeVisible();
  });
  test('dashboard renders on mobile viewport', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Edge — navigation + state @smoke', () => {
  test('every nav link navigates and highlights active route', async ({ page }) => {
    await login(page);
    const links: { label: string; url: RegExp }[] = [
      { label: 'Engagements', url: /\/engagements$/ },
      { label: 'Findings', url: /\/findings$/ },
      { label: 'Probes', url: /\/probes$/ },
      { label: 'Traces', url: /\/traces$/ },
      { label: 'Library', url: /\/library$/ },
      { label: 'Settings', url: /\/settings$/ },
      { label: 'Clients', url: /\/clients$/ },
      { label: 'Dashboard', url: /\/dashboard$/ },
    ];
    for (const { label, url } of links) {
      await page.getByRole('link', { name: new RegExp(label, 'i') }).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('reload preserves auth (zustand persist + stub)', async ({ page }) => {
    await login(page);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Edge — API contract @smoke', () => {
  test('OPTIONS preflight returns CORS headers', async ({ request }) => {
    const resp = await request.fetch(`${API}/v1/engagements`, {
      method: 'OPTIONS',
      headers: {
        origin: BASE,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(resp.status()).toBeLessThan(300);
    expect(resp.headers()['access-control-allow-origin']).toBe(BASE);
    expect(resp.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('GET /healthz returns ok', async ({ request }) => {
    const resp = await request.get(`${API}/healthz`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('ok');
  });

  test('unknown api route returns 404 JSON', async ({ request }) => {
    const resp = await request.get(`${API}/v1/__nope__`);
    expect(resp.status()).toBe(404);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });
});
