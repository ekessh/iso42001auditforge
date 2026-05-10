// SPDX-License-Identifier: BUSL-1.1
/**
 * Page Object Models tailored to the local-stack auditor workflow tests.
 *
 * WHY a second POM file: tests/e2e/helpers/page-objects.ts targets the full
 * Docker dev-stack (test-only injection endpoints, signed report flow). These
 * classes target the read-mostly local-stack (NEXT_PUBLIC_AUTH_STUB=1 +
 * dev-mock-api on :4000) and intentionally use real DOM selectors only.
 *
 * Each class holds a Page handle + a BASE URL it captured at construction.
 * Methods return Promise<void> unless they yield an identifier the caller
 * needs (e.g. createdEngagementId).
 */
import { type Locator, type Page, expect } from '@playwright/test';

const DEFAULT_BASE = 'http://localhost:3000';

abstract class BasePage {
  readonly page: Page;
  readonly base: string;

  constructor(page: Page, base: string = process.env['E2E_BASE_URL'] ?? DEFAULT_BASE) {
    this.page = page;
    this.base = base.replace(/\/$/, '');
  }

  get header(): Locator {
    return this.page.locator('header');
  }

  get sidebar(): Locator {
    return this.page.getByLabel('Primary navigation');
  }

  async navigate(path: string): Promise<void> {
    await this.page.goto(`${this.base}${path}`);
  }
}

export class LoginPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/login');
    await expect(this.page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }

  async signInStub(): Promise<void> {
    if (!this.page.url().includes('/login')) await this.goto();
    await this.page.getByRole('button', { name: /Continue with passkey/i }).click();
    await expect(this.page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  }
}

export class DashboardPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/dashboard');
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectKpi(label: string, value?: string | number): Promise<void> {
    const kpi = this.page.getByText(new RegExp(label, 'i')).first();
    await expect(kpi, `KPI "${label}" should be visible on dashboard`).toBeVisible();
    if (value !== undefined) {
      await expect(this.page.getByText(String(value)).first()).toBeVisible();
    }
  }

  async clickQuickAction(label: string): Promise<void> {
    const btn = this.page.getByRole('button', { name: new RegExp(label, 'i') });
    await expect(btn, `Quick action "${label}" should exist`).toBeVisible();
    await btn.click();
  }
}

export class EngagementsPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/engagements');
    await expect(this.page).toHaveURL(/\/engagements$/);
  }

  async expectListContains(text: string): Promise<void> {
    await expect(
      this.page.getByRole('main').getByText(new RegExp(text, 'i')).first(),
      `Engagements list should contain "${text}"`,
    ).toBeVisible({ timeout: 15_000 });
  }

  async openEngagement(idOrText: string): Promise<void> {
    const link = this.page.getByRole('link', { name: new RegExp(idOrText, 'i') }).first();
    await expect(link, `Engagement link "${idOrText}" should exist`).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(this.page).toHaveURL(/\/engagements\/[^/]+$/);
  }

  async clickNewEngagement(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /New engagement|Start new engagement/i });
    await expect(btn, '"New engagement" affordance should exist').toBeVisible();
    await btn.click();
  }
}

export class EngagementDetailPage extends BasePage {
  async clickTab(name: string): Promise<void> {
    const tab = this.page.getByRole('tab', { name: new RegExp(`^${name}$`, 'i') });
    await expect(tab, `Tab "${name}" should be visible`).toBeVisible({ timeout: 10_000 });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  async expectTabContent(matcher: RegExp | string): Promise<void> {
    const re = typeof matcher === 'string' ? new RegExp(matcher, 'i') : matcher;
    await expect(
      this.page.getByRole('tabpanel').getByText(re).first(),
      `Active tab content should match ${re}`,
    ).toBeVisible({ timeout: 10_000 });
  }

  async clickRaiseNc(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Raise NC|Raise.*finding|New.*finding/i });
    await expect(btn, '"Raise NC" affordance should exist on engagement detail').toBeVisible();
    await btn.click();
  }

  async clickGenerateReportDraft(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Generate.*draft|Generate report/i });
    await expect(btn, '"Generate draft" button should exist on Report tab').toBeVisible();
    await expect(btn).toBeEnabled();
    await btn.click();
  }
}

export class FindingsPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/findings');
    await expect(this.page).toHaveURL(/\/findings$/);
  }

  async clickRaiseNc(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Raise NC|Raise.*finding|New.*finding/i });
    await expect(btn, '"Raise NC" affordance should exist on findings list').toBeVisible();
    await btn.click();
  }

  async expectFindingVisible(title: string): Promise<void> {
    await expect(
      this.page.getByRole('link', { name: new RegExp(title, 'i') }).first(),
      `Finding "${title}" should be visible`,
    ).toBeVisible({ timeout: 15_000 });
  }

  async openFinding(title: string): Promise<void> {
    const link = this.page.getByRole('link', { name: new RegExp(title, 'i') }).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(this.page).toHaveURL(/\/findings\/[^/]+$/);
  }

  async filterBySeverity(severity: 'major_nc' | 'minor_nc' | 'ofi' | 'conformity'): Promise<void> {
    const labelMap: Record<typeof severity, RegExp> = {
      major_nc: /^Major NC$/,
      minor_nc: /^Minor NC$/,
      ofi: /^OFI$/,
      conformity: /^Conformity$/,
    };
    const btn = this.page.getByRole('button', { name: labelMap[severity] });
    await expect(btn, 'Severity filter chip should exist on findings page').toBeVisible();
    await btn.click();
  }

  async filterByStatus(status: string): Promise<void> {
    const label = status.replace(/_/g, ' ');
    const btn = this.page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
    await expect(btn, 'Status filter chip should exist on findings page').toBeVisible();
    await btn.click();
  }

  async expectRowCount(min: number, max?: number): Promise<void> {
    const rows = this.page.getByRole('main').locator('tbody tr');
    const count = await rows.count();
    expect(count, `expected at least ${min} finding rows, got ${count}`).toBeGreaterThanOrEqual(min);
    if (max !== undefined) {
      expect(count, `expected at most ${max} finding rows, got ${count}`).toBeLessThanOrEqual(max);
    }
  }
}

export class FindingDetailPage extends BasePage {
  async clickPromote(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Promote/i });
    await expect(btn, '"Promote" button should exist on finding detail').toBeVisible();
    await btn.click();
  }

  async clickAssignCapa(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Assign CAPA|Add CAPA/i });
    await expect(btn, '"Assign CAPA" button should exist on finding detail').toBeVisible();
    await btn.click();
  }

  async expectStatus(status: string): Promise<void> {
    await expect(
      this.page.getByText(new RegExp(status.replace(/_/g, '[ _]'), 'i')).first(),
      `Finding status should reflect "${status}"`,
    ).toBeVisible({ timeout: 10_000 });
  }
}

export class ClientsPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/clients');
    await expect(this.page).toHaveURL(/\/clients$/);
  }

  async clickNewClient(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /New client/i });
    await expect(btn, '"New client" affordance should exist').toBeVisible();
    await btn.click();
  }

  async expectClientVisible(name: string): Promise<void> {
    await expect(
      this.page.getByRole('main').getByText(new RegExp(name, 'i')).first(),
      `Client "${name}" should be in the list`,
    ).toBeVisible({ timeout: 15_000 });
  }
}

export class ProbesPage extends BasePage {
  async goto(engagementId?: string): Promise<void> {
    if (engagementId) {
      await this.navigate(`/engagements/${engagementId}`);
      await this.page.getByRole('tab', { name: /^Probes$/i }).click();
    } else {
      await this.navigate('/probes');
      await expect(this.page).toHaveURL(/\/probes$/);
    }
  }

  async clickRun(probeId: string): Promise<void> {
    const btn = this.page.getByRole('button', { name: new RegExp(`Run.*${probeId}|\\+\\s*Run probe`, 'i') });
    await expect(btn, `"Run ${probeId}" affordance should exist`).toBeVisible();
    await btn.click();
  }

  async expectExecutionRecorded(): Promise<void> {
    await expect(
      this.page.getByText(/queued|running|success|completed/i).first(),
      'A new probe execution row should appear',
    ).toBeVisible({ timeout: 10_000 });
  }
}

export class LibraryPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/library');
    await expect(this.page).toHaveURL(/\/library$/);
  }

  async search(q: string): Promise<void> {
    const box = this.page.getByPlaceholder(/Search by ref or title/i);
    await expect(box).toBeVisible();
    await box.fill(q);
  }

  async filterByKind(kind: string): Promise<void> {
    const group = this.page.getByRole('group', { name: 'Filter by source' });
    await expect(group).toBeAttached();
    const labelMap: Record<string, RegExp> = {
      iso42001_clause: /ISO 42001 clause/i,
      annex_a_control: /Annex A control/i,
      eu_ai_act_article: /EU AI Act/i,
      nist_ai_rmf: /NIST AI RMF/i,
      owasp_llm: /OWASP/i,
      mitre_atlas: /MITRE ATLAS/i,
      avid: /AVID/i,
      mit_air: /MIT AI Risk/i,
      question: /^Question$/i,
    };
    const label = labelMap[kind] ?? new RegExp(kind, 'i');
    await group.getByRole('button', { name: label }).click();
  }

  async expectResultCount(min: number, max?: number): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    const rows = this.page.getByRole('main').locator('ul > li');
    const count = await rows.count();
    expect(count, `expected at least ${min} library rows, got ${count}`).toBeGreaterThanOrEqual(min);
    if (max !== undefined) {
      expect(count, `expected at most ${max} library rows, got ${count}`).toBeLessThanOrEqual(max);
    }
  }
}

export class SettingsPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/settings');
    await expect(this.page).toHaveURL(/\/settings$/);
  }

  async expectAuditor(name: string): Promise<void> {
    await expect(
      this.page.getByRole('main').getByText(new RegExp(name, 'i')).first(),
      `Settings should show signed-in auditor "${name}"`,
    ).toBeVisible();
  }

  async signOut(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /Sign out/i });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(this.page).toHaveURL(/\/login$/, { timeout: 10_000 });
  }
}
