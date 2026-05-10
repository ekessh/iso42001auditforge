// SPDX-License-Identifier: BUSL-1.1
/**
 * End-to-end Lead-Auditor narrative tests against the local stack.
 *
 * Targets: web on :3000 (NEXT_PUBLIC_AUTH_STUB=1, NEXT_DISABLE_PWA=1) +
 *          dev-mock-api on :4000.
 *
 * Each test reads as a story: sign in, create/mutate something, verify the
 * state change shows in the UI AND in the audit trail. Tests that depend on
 * UI affordances not yet shipped by agent A are .fixme()'d with an inline
 * TODO that names the missing affordance — they MUST NOT silently pass.
 *
 * Run:
 *   E2E_SKIP_GLOBAL_SETUP=1 \
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_API_URL=http://localhost:4000 \
 *     pnpm --filter @auditforge/e2e exec playwright test \
 *       journeys/local-stack-workflow --project=chromium --reporter=list
 */
import { expect, test } from '@playwright/test';
import {
  ClientsPage,
  DashboardPage,
  EngagementDetailPage,
  EngagementsPage,
  FindingDetailPage,
  FindingsPage,
  LoginPage,
  ProbesPage,
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
  test.fixme(
    'End-to-end: plan a new engagement from scratch',
    async ({ page }) => {
      // TODO(agent-A): wire "Start new engagement" quick-action on /dashboard
      // to a creation wizard. Today the <Action label="Start new engagement">
      // button on /dashboard has no onClick handler. The dev-mock-api also
      // needs POST /v1/engagements + POST /v1/clients + POST /v1/findings to
      // accept the new records this narrative writes back.
      const login = new LoginPage(page);
      const dashboard = new DashboardPage(page);
      const engagements = new EngagementsPage(page);
      const clients = new ClientsPage(page);
      const detail = new EngagementDetailPage(page);
      const findingsPage = new FindingsPage(page);

      await login.signInStub();
      await dashboard.clickQuickAction('Start new engagement');
      await page.getByLabel(/Client name/i).fill('Acme Corp');
      await page.getByLabel(/Scope/i).fill('AIMS for customer-facing chatbot');
      await page.getByLabel(/Mode/i).selectOption('audit');
      await page.getByLabel(/Stage/i).selectOption('stage1');
      await page.getByLabel(/Starts on/i).fill('2026-06-01');
      await page.getByLabel(/Ends on/i).fill('2026-06-15');
      await page.getByRole('button', { name: /Create engagement/i }).click();

      await expect(page).toHaveURL(/\/engagements\/[^/]+$/);
      await dashboard.goto();
      await expect(page.getByText(/Acme Corp/i).first()).toBeVisible();
      await engagements.goto();
      await engagements.expectListContains('AIMS for customer-facing chatbot');
      await clients.goto();
      await clients.expectClientVisible('Acme Corp');

      await engagements.openEngagement('Acme Corp');
      await detail.clickTab('Plan');
      await detail.expectTabContent(/AIMS for customer-facing chatbot/);
      await detail.clickTab('Findings');
      await detail.clickRaiseNc();
      await page.getByLabel(/Title/i).fill('Missing impact assessment');
      await page.getByLabel(/Severity/i).selectOption('minor_nc');
      await page.getByLabel(/Control/i).fill('6.1.2');
      await page.getByRole('button', { name: /Save/i }).click();

      await detail.expectTabContent(/Missing impact assessment/);
      await findingsPage.goto();
      await findingsPage.expectFindingVisible('Missing impact assessment');
      await page.goBack();
      await detail.clickTab('Audit Trail');
      await detail.expectTabContent(/finding\.raised/);
    },
  );

  test.fixme(
    'End-to-end: triage candidate finding to formal NC with CAPA',
    async ({ page }) => {
      // TODO(agent-A): the engagement detail Findings tab has no "Raise NC"
      // affordance, and finding detail has no "Promote" / "Assign CAPA"
      // buttons (see apps/web/app/(auditor)/findings/[findingId]/page.tsx).
      // Mock API also needs PATCH /v1/findings/:id to flip status to
      // capa_pending.
      const login = new LoginPage(page);
      const detail = new EngagementDetailPage(page);
      const findingDetail = new FindingDetailPage(page);

      await login.signInStub();
      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Findings');
      await detail.clickRaiseNc();
      await page.getByLabel(/Title/i).fill('AIMS scope statement out of date');
      await page.getByLabel(/Severity/i).selectOption('major_nc');
      await page.getByLabel(/Control/i).fill('4.3');
      await page.getByRole('button', { name: /Save/i }).click();

      await page.getByRole('link', { name: /AIMS scope statement out of date/i }).first().click();
      await findingDetail.clickAssignCapa();
      await page.getByLabel(/Plan|Action/i).fill('Update AIMS scope statement and re-issue.');
      await page.getByLabel(/Target date/i).fill('2026-08-01');
      await page.getByRole('button', { name: /Save/i }).click();
      await findingDetail.expectStatus('capa_pending');

      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Findings');
      await detail.expectTabContent(/AIMS scope statement out of date/);
      await detail.expectTabContent(/capa.pending/);
    },
  );

  test.fixme(
    'End-to-end: run a probe and verify the execution',
    async ({ page }) => {
      // TODO(agent-A): probes tab on engagement detail has no "+ Run probe"
      // affordance (see /engagements/[engagementId]/page.tsx Probes branch).
      // Mock API also needs POST /v1/probes/executions and a way to flip the
      // execution status from queued -> success.
      const login = new LoginPage(page);
      const detail = new EngagementDetailPage(page);
      const probes = new ProbesPage(page);

      await login.signInStub();
      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Probes');
      await probes.clickRun('P-LLM-01');
      await page.getByLabel(/Target endpoint/i).fill('http://localhost:8080/chat');
      await page.getByRole('button', { name: /Submit|Run/i }).click();

      await expect(page.getByText(/queued/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/success/i).first()).toBeVisible({ timeout: 10_000 });
    },
  );

  test.fixme(
    'End-to-end: ingest a trace via upload',
    async ({ page }) => {
      // TODO(agent-A): traces tab + /traces page have no upload affordance.
      // Need an "Upload trace" button bound to a file chooser, plus
      // POST /v1/traces in dev-mock-api.
      const login = new LoginPage(page);
      const detail = new EngagementDetailPage(page);

      await login.signInStub();
      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Traces');

      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: /Upload trace/i }).click(),
      ]);
      await chooser.setFiles({
        name: 'sample-trace.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('span: 1\nspan: 2\n'),
      });

      await detail.expectTabContent(/sample-trace/);
      await page.goto(`${BASE}/traces`);
      await expect(
        page.getByRole('main').getByText(/sample-trace/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  test.fixme(
    'End-to-end: draft a report',
    async ({ page }) => {
      // TODO(agent-A): Report tab currently shows only a disabled
      // "Publish draft (locked)" button — there is no enabled
      // "Generate draft" affordance and no JSON pane rendering qaChecklist
      // / coverageSummary. Needs UI + mock POST /v1/engagements/:id/report.
      const login = new LoginPage(page);
      const detail = new EngagementDetailPage(page);

      await login.signInStub();
      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Report');
      await detail.clickGenerateReportDraft();

      await expect(
        page.getByRole('tabpanel').getByText(/qaChecklist/i),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole('tabpanel').getByText(/coverageSummary/i),
      ).toBeVisible();

      await detail.clickTab('Audit Trail');
      await detail.expectTabContent(/report\.draft\.generated/);
    },
  );

  test.fixme(
    'Audit trail is hash-chained',
    async ({ page }) => {
      // TODO(agent-A): Audit Trail tab today renders a static notice ("Ledger
      // view is rendered server-side at …, not wired in the local mock
      // stack."). Needs to render hash-chained event rows showing both
      // chainHash and prevHash so this test can assert prevHash[i] ==
      // chainHash[i-1].
      const login = new LoginPage(page);
      const detail = new EngagementDetailPage(page);

      await login.signInStub();
      await page.goto(`${BASE}/engagements/eng-001`);
      await detail.clickTab('Audit Trail');

      const events = page.getByRole('tabpanel').getByTestId('ledger-event');
      const count = await events.count();
      expect(count, 'audit trail should list at least 2 events').toBeGreaterThanOrEqual(2);

      const hashes: { chain: string; prev: string }[] = [];
      for (let i = 0; i < count; i += 1) {
        const row = events.nth(i);
        hashes.push({
          chain: (await row.getByTestId('chain-hash').innerText()).trim(),
          prev: (await row.getByTestId('prev-hash').innerText()).trim(),
        });
      }
      for (let i = 1; i < hashes.length; i += 1) {
        expect(
          hashes[i]!.prev,
          `event[${i}].prevHash must equal event[${i - 1}].chainHash`,
        ).toBe(hashes[i - 1]!.chain);
      }
    },
  );

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
