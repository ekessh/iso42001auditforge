// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Page Object Models for AuditForge critical UI surfaces.
 * Real DOM interactions only — no synthetic shortcuts.
 */
import { type Page, type Locator, expect } from "@playwright/test";

/** Performance budget: LCP must be < 2500ms */
const LCP_BUDGET_MS = 2500;

export async function assertPageLCP(page: Page, budgetMs = LCP_BUDGET_MS): Promise<void> {
  const lcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) resolve(last.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
      // Fallback: domContentLoadedEventEnd
      setTimeout(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        resolve(nav?.domContentLoadedEventEnd ?? 0);
      }, 3000);
    });
  });
  expect(lcp, `LCP ${lcp}ms exceeds budget of ${budgetMs}ms`).toBeLessThanOrEqual(budgetMs);
}

// ── Auth page ─────────────────────────────────────────────────────────────────

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly passkeyButton: Locator;
  readonly errorBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByRole("textbox", { name: /email/i });
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole("button", { name: /sign in/i });
    this.passkeyButton = page.getByRole("button", { name: /passkey|use.*key|biometric/i });
    this.errorBanner = page.getByRole("alert");
  }

  async goto(): Promise<void> {
    await this.page.goto("/auth/signin");
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async loginWithPassword(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL(/\/dashboard|\/home/, { timeout: 15_000 });
  }
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export class DashboardPage {
  readonly page: Page;
  readonly clientsLink: Locator;
  readonly engagementsLink: Locator;
  readonly newEngagementButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.clientsLink = page.getByRole("link", { name: /clients/i });
    this.engagementsLink = page.getByRole("link", { name: /engagements/i });
    this.newEngagementButton = page.getByRole("button", { name: /new engagement|start audit/i });
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }
}

// ── Engagement wizard ─────────────────────────────────────────────────────────

export class EngagementWizardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectClient(clientName: string): Promise<void> {
    await this.page.getByRole("combobox", { name: /client/i }).click();
    await this.page.getByRole("option", { name: clientName }).click();
  }

  async selectCertificationStandard(standard: string): Promise<void> {
    await this.page.getByRole("combobox", { name: /standard/i }).click();
    await this.page.getByRole("option", { name: standard }).click();
  }

  async selectCycleType(cycle: "initial" | "surveillance" | "recertification"): Promise<void> {
    await this.page.getByRole("radio", { name: new RegExp(cycle, "i") }).check();
  }

  async assignLeadAuditor(auditorName: string): Promise<void> {
    await this.page.getByRole("combobox", { name: /lead auditor/i }).click();
    await this.page.getByRole("option", { name: auditorName }).click();
  }

  async submit(): Promise<string> {
    await this.page.getByRole("button", { name: /create|start/i }).click();
    // Returns newly created engagement ID from URL
    await this.page.waitForURL(/\/engagements\/[a-z0-9-]+/, { timeout: 10_000 });
    const url = this.page.url();
    return url.split("/engagements/")[1]?.split("/")[0] ?? "";
  }
}

// ── Audit plan builder ────────────────────────────────────────────────────────

export class AuditPlanPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string, eventId?: string): Promise<void> {
    const path = eventId
      ? `/engagements/${engagementId}/events/${eventId}/plan`
      : `/engagements/${engagementId}/plan`;
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async addPlanSession(opts: { title: string; startTime: string; endTime: string; area: string }): Promise<void> {
    await this.page.getByRole("button", { name: /add session|new session/i }).click();
    await this.page.getByLabel(/session title/i).fill(opts.title);
    await this.page.getByLabel(/start.*time|from/i).fill(opts.startTime);
    await this.page.getByLabel(/end.*time|to/i).fill(opts.endTime);
    await this.page.getByLabel(/area|clause/i).fill(opts.area);
    await this.page.getByRole("button", { name: /save|add/i }).click();
  }

  async sendToAuditee(): Promise<void> {
    await this.page.getByRole("button", { name: /send.*auditee|share.*plan/i }).click();
    await this.page.getByRole("button", { name: /confirm|send/i }).click();
    await expect(this.page.getByRole("alert", { name: /sent|shared/i })).toBeVisible();
  }
}

// ── Working paper editor ──────────────────────────────────────────────────────

export class WorkingPaperPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string, wpId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/working-papers/${wpId}`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async enterObservation(text: string): Promise<void> {
    const editor = this.page.locator('[data-testid="wp-editor"], [contenteditable="true"]').first();
    await editor.click();
    await editor.fill(text);
  }

  async setVerdict(verdict: "conformant" | "minor_nc" | "major_nc" | "ofi" | "na"): Promise<void> {
    await this.page.getByRole("combobox", { name: /verdict/i }).click();
    await this.page.getByRole("option", { name: new RegExp(verdict.replace("_", " "), "i") }).click();
  }

  async uploadEvidence(filePath: string): Promise<void> {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page.getByRole("button", { name: /attach.*evidence|upload/i }).click(),
    ]);
    await fileChooser.setFiles(filePath);
    await this.page.waitForSelector('[data-testid="evidence-upload-complete"]', { timeout: 30_000 });
  }

  async save(): Promise<void> {
    await this.page.keyboard.press("Control+S");
    // Or explicit save button
    const saveBtn = this.page.getByRole("button", { name: /save/i });
    if (await saveBtn.isVisible()) await saveBtn.click();
    await expect(this.page.getByText(/saved|up to date/i)).toBeVisible({ timeout: 5_000 });
  }

  async goOffline(): Promise<void> {
    await this.page.context().setOffline(true);
  }

  async goOnline(): Promise<void> {
    await this.page.context().setOffline(false);
    // Wait for sync indicator
    await expect(this.page.getByTestId("sync-indicator")).toContainText(/synced|up.to.date/i, {
      timeout: 15_000,
    });
  }
}

// ── Findings page ─────────────────────────────────────────────────────────────

export class FindingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/findings`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async raiseFinding(opts: {
    type: "major_nc" | "minor_nc" | "ofi";
    clause: string;
    statement: string;
    evidence: string;
  }): Promise<string> {
    await this.page.getByRole("button", { name: /raise.*finding|new.*finding/i }).click();
    await this.page.getByRole("radio", { name: new RegExp(opts.type.replace("_", " "), "i") }).check();
    await this.page.getByRole("combobox", { name: /clause/i }).fill(opts.clause);
    await this.page.getByRole("option").first().click();
    await this.page.getByLabel(/statement|description/i).fill(opts.statement);
    await this.page.getByLabel(/evidence.*ref|evidence/i).fill(opts.evidence);
    await this.page.getByRole("button", { name: /save|raise/i }).click();
    await this.page.waitForURL(/\/findings\/[a-z0-9-]+/);
    const url = this.page.url();
    return url.split("/findings/")[1]?.split("/")[0] ?? "";
  }
}

// ── Report page ───────────────────────────────────────────────────────────────

export class ReportPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/report`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async generateReport(type: "stage1" | "stage2" | "surveillance" | "recertification"): Promise<void> {
    await this.page.getByRole("tab", { name: new RegExp(type.replace("_", " "), "i") }).click();
    await this.page.getByRole("button", { name: /generate|compile/i }).click();
    // Wait for async generation
    await this.page.waitForSelector('[data-testid="report-ready"]', { timeout: 60_000 });
  }

  async signReport(): Promise<void> {
    await this.page.getByRole("button", { name: /sign.*report|digital.*sign/i }).click();
    // WebAuthn modal
    await expect(this.page.getByRole("dialog", { name: /sign|authenticate/i })).toBeVisible();
    // In test env, mock passkey is auto-completed by the test credential injector
    await this.page.waitForSelector('[data-testid="signature-complete"]', { timeout: 30_000 });
  }

  async downloadPdf(): Promise<string> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.getByRole("button", { name: /download.*pdf|export.*pdf/i }).click(),
    ]);
    const path = await download.path();
    return path ?? "";
  }

  async archiveFile(): Promise<void> {
    await this.page.getByRole("button", { name: /archive.*file|freeze|finalise/i }).click();
    await this.page.getByRole("button", { name: /confirm|yes/i }).click();
    await expect(this.page.getByText(/archived|frozen|immutable/i)).toBeVisible({ timeout: 15_000 });
  }
}

// ── Probe runner page ─────────────────────────────────────────────────────────

export class ProbeRunnerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string, aiSystemId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/ai-systems/${aiSystemId}/probes`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async selectProbe(probeId: string): Promise<void> {
    await this.page.getByTestId(`probe-${probeId}`).check();
  }

  async setExecutionMode(mode: "offline" | "live" | "replay"): Promise<void> {
    await this.page.getByRole("radio", { name: new RegExp(mode, "i") }).check();
  }

  async runSelectedProbes(): Promise<void> {
    await this.page.getByRole("button", { name: /run.*probe|execute.*probe/i }).click();
    await this.page.waitForSelector('[data-testid="probe-run-complete"]', { timeout: 120_000 });
  }

  async linkResultToWorkingPaper(probeRunId: string, wpId: string): Promise<void> {
    await this.page.getByTestId(`probe-result-${probeRunId}`).getByRole("button", { name: /link.*wp|add.*to.*paper/i }).click();
    await this.page.getByRole("combobox", { name: /working paper/i }).click();
    await this.page.getByRole("option", { name: wpId }).click();
    await this.page.getByRole("button", { name: /link|save/i }).click();
  }
}

// ── Trace analyzer page ───────────────────────────────────────────────────────

export class TraceAnalyzerPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string, agentSystemId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/ai-systems/${agentSystemId}/traces`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async importTrace(traceFixturePath: string): Promise<void> {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page.getByRole("button", { name: /import.*trace|upload.*trace/i }).click(),
    ]);
    await fileChooser.setFiles(traceFixturePath);
    await this.page.waitForSelector('[data-testid="trace-imported"]', { timeout: 30_000 });
  }

  async analyzeTrace(traceId: string): Promise<void> {
    await this.page.getByTestId(`trace-${traceId}`).getByRole("button", { name: /analyze/i }).click();
    await this.page.waitForSelector('[data-testid="trace-analysis-ready"]', { timeout: 60_000 });
  }

  async reviewToolAclDrift(): Promise<{ driftCount: number }> {
    await this.page.getByRole("tab", { name: /tool.*acl|permission.*drift/i }).click();
    const driftItems = await this.page.locator('[data-testid="acl-drift-item"]').count();
    return { driftCount: driftItems };
  }

  async raiseFindingFromDrift(driftItemIndex: number): Promise<string> {
    await this.page.locator('[data-testid="acl-drift-item"]').nth(driftItemIndex).getByRole("button", { name: /raise.*finding/i }).click();
    await this.page.getByRole("button", { name: /confirm|save/i }).click();
    await this.page.waitForURL(/\/findings\/[a-z0-9-]+/);
    const url = this.page.url();
    return url.split("/findings/")[1]?.split("/")[0] ?? "";
  }
}

// ── Peer review page ──────────────────────────────────────────────────────────

export class PeerReviewPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/peer-review`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async requestChanges(comment: string): Promise<void> {
    await this.page.getByRole("button", { name: /request.*changes/i }).click();
    await this.page.getByLabel(/comment|reason/i).fill(comment);
    await this.page.getByRole("button", { name: /submit|send/i }).click();
    await expect(this.page.getByText(/changes.*requested|review.*submitted/i)).toBeVisible();
  }

  async approveReview(): Promise<void> {
    await this.page.getByRole("button", { name: /approve|sign.*off/i }).click();
    await this.page.getByRole("button", { name: /confirm|yes/i }).click();
    await expect(this.page.getByText(/approved|signed.*off/i)).toBeVisible({ timeout: 10_000 });
  }
}

// ── Archive portal page ───────────────────────────────────────────────────────

export class ArchivePortalPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/archive/${engagementId}`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async verifySignature(): Promise<{ valid: boolean; details: string }> {
    await this.page.getByRole("button", { name: /verify.*signature|check.*sig/i }).click();
    await this.page.waitForSelector('[data-testid="sig-verification-result"]', { timeout: 15_000 });
    const isValid = await this.page.getByTestId("sig-valid-badge").isVisible();
    const details = await this.page.getByTestId("sig-verification-details").textContent() ?? "";
    return { valid: isValid, details };
  }

  async assertReadOnly(): Promise<void> {
    // Ensure no edit buttons exist
    const editButtons = this.page.getByRole("button", { name: /edit|modify|delete/i });
    await expect(editButtons).toHaveCount(0);
  }
}

// ── Auditee portal page ───────────────────────────────────────────────────────

export class AuditeePortalPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/portal");
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async viewAuditPlan(planId: string): Promise<void> {
    await this.page.getByTestId(`plan-${planId}`).click();
    await this.page.waitForLoadState("networkidle");
  }

  async uploadEvidence(findingId: string, filePath: string): Promise<void> {
    await this.page.getByTestId(`finding-${findingId}`).getByRole("button", { name: /upload.*evidence|attach/i }).click();
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.page.getByRole("button", { name: /choose file/i }).click(),
    ]);
    await fileChooser.setFiles(filePath);
    await this.page.waitForSelector('[data-testid="upload-complete"]', { timeout: 30_000 });
  }

  async submitCapa(findingId: string, capaDescription: string): Promise<void> {
    await this.page.getByTestId(`finding-${findingId}`).getByRole("button", { name: /respond|submit.*capa/i }).click();
    await this.page.getByLabel(/corrective action|description/i).fill(capaDescription);
    await this.page.getByRole("button", { name: /submit/i }).click();
    await expect(this.page.getByText(/submitted|received/i)).toBeVisible({ timeout: 10_000 });
  }
}

// ── Surveillance dashboard ────────────────────────────────────────────────────

export class SurveillanceDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/surveillance`);
    await this.page.waitForLoadState("networkidle");
    await assertPageLCP(this.page);
  }

  async triggerThresholdBreach(metricId: string, value: number): Promise<void> {
    // Test-only endpoint: inject a metric value that breaches threshold
    await this.page.evaluate(
      ({ metricId, value }) => {
        return fetch("/api/v1/test/surveillance/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metricId, value }),
        });
      },
      { metricId, value },
    );
    // Wait for alert to appear
    await expect(this.page.getByRole("alert", { name: /threshold.*breach|alert/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  async reviewAdHocAuditConsideration(): Promise<void> {
    await this.page.getByRole("button", { name: /consider.*ad.hoc|schedule.*audit/i }).click();
    await this.page.waitForLoadState("networkidle");
  }
}
