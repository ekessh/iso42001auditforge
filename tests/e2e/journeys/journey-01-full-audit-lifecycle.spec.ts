// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 1 — Full Audit Lifecycle (Lead Auditor)
 *
 * Auditor login (passkey) → create client → create engagement →
 * build audit plan → conduct Stage 2 audit (WPs + observations) →
 * raise findings → generate report → sign → archive
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import {
  AuthPage,
  DashboardPage,
  EngagementWizardPage,
  AuditPlanPage,
  WorkingPaperPage,
  FindingsPage,
  ReportPage,
  assertPageLCP,
} from "../helpers/page-objects";

const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const SAMPLE_EVIDENCE = path.resolve(__dirname, "../../fixtures/reports/sample-evidence.pdf");

test.use({ storageState: LEAD_AUTH_STATE });

test("J1: complete audit lifecycle from login to archive", async ({ page }) => {
  // ── Step 1: Authenticate ───────────────────────────────────────────────
  const auth = new AuthPage(page);
  await auth.goto();
  await auth.loginWithPassword("lead@auditforge.test", "LeadAuditor_Test_2024!");

  await expect(page).toHaveURL(/\/dashboard/);
  await page.screenshot({ path: "test-results/j1-01-dashboard.png" });

  // ── Step 2: Navigate to existing seeded engagement ────────────────────
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await assertPageLCP(page);

  await page.getByRole("link", { name: /ClientAlpha Corp/i }).first().click();
  await page.waitForURL(/\/clients\/[a-z0-9-]+/);
  await page.screenshot({ path: "test-results/j1-02-client.png" });

  await page.getByRole("link", { name: /engagements/i }).click();
  await page.getByRole("link", { name: /Initial Certification/i }).first().click();
  await page.waitForURL(/\/engagements\/[a-z0-9-]+/);
  const engagementUrl = page.url();
  const engagementId = engagementUrl.split("/engagements/")[1]?.split("/")[0];
  expect(engagementId).toBeTruthy();
  await page.screenshot({ path: "test-results/j1-03-engagement.png" });

  // ── Step 3: Build / review Stage 2 audit plan ─────────────────────────
  const auditPlan = new AuditPlanPage(page);
  await auditPlan.goto(engagementId!);
  await assertPageLCP(page);

  await auditPlan.addPlanSession({
    title: "Opening Meeting",
    startTime: "09:00",
    endTime: "09:30",
    area: "Opening",
  });
  await auditPlan.addPlanSession({
    title: "Clause 4 - Context",
    startTime: "09:30",
    endTime: "11:00",
    area: "Clause 4",
  });
  await auditPlan.addPlanSession({
    title: "Clause 6 - Planning & Risk",
    startTime: "11:00",
    endTime: "13:00",
    area: "Clause 6",
  });
  await auditPlan.addPlanSession({
    title: "Technical AI Assessment",
    startTime: "14:00",
    endTime: "16:00",
    area: "Annex A.6 - AI System Lifecycle",
  });

  await auditPlan.sendToAuditee();
  await page.screenshot({ path: "test-results/j1-04-plan-sent.png" });

  // ── Step 4: Create Stage 2 working papers ─────────────────────────────
  await page.goto(`/engagements/${engagementId}/working-papers/new`);
  await page.waitForLoadState("networkidle");

  // Select clause 4.1 - Understanding the organization
  await page.getByRole("combobox", { name: /clause/i }).click();
  await page.getByRole("option", { name: /4\.1.*Understanding the organization/i }).click();

  await page.getByRole("button", { name: /create.*working paper/i }).click();
  await page.waitForURL(/\/working-papers\/[a-z0-9-]+/);
  const wpUrl = page.url();
  const wpId = wpUrl.split("/working-papers/")[1]?.split("/")[0] ?? "";

  const wp = new WorkingPaperPage(page);
  await wp.enterObservation(
    "Reviewed the organization's documented understanding of internal and external issues " +
      "relevant to the AIMS. Client has produced a Context Statement document (ref: CS-2024-001) " +
      "identifying 12 external issues and 8 internal issues. Sighted and sampled.",
  );
  await wp.setVerdict("conformant");
  await wp.uploadEvidence(SAMPLE_EVIDENCE);
  await wp.save();
  await page.screenshot({ path: "test-results/j1-05-working-paper.png" });

  // ── Step 5: Raise a finding ───────────────────────────────────────────
  const findings = new FindingsPage(page);
  await findings.goto(engagementId!);

  const findingId = await findings.raiseFinding({
    type: "minor_nc",
    clause: "8.4",
    statement:
      "The organization has not documented the criteria for AI system lifecycle stage transitions " +
      "as required by clause 8.4. The AI system lifecycle procedure (AIML-PROC-003) references " +
      "transition criteria but does not define them explicitly.",
    evidence: "AIML-PROC-003 v2.1, section 4.3 — reviewed during Stage 2 day 1",
  });

  expect(findingId).toBeTruthy();
  await page.screenshot({ path: "test-results/j1-06-finding-raised.png" });

  // ── Step 6: Generate report ───────────────────────────────────────────
  const report = new ReportPage(page);
  await report.goto(engagementId!);
  await report.generateReport("stage2");
  await page.screenshot({ path: "test-results/j1-07-report-generated.png" });

  // Verify report includes the finding
  await expect(page.getByText(/minor.*nc|NC-/i)).toBeVisible();
  await expect(page.getByText(/8\.4/)).toBeVisible();

  // ── Step 7: Sign report ───────────────────────────────────────────────
  await report.signReport();
  await page.screenshot({ path: "test-results/j1-08-report-signed.png" });

  // Verify signature indicator
  await expect(page.getByTestId("report-signature-valid")).toBeVisible();

  // ── Step 8: Archive audit file ────────────────────────────────────────
  await report.archiveFile();
  await page.screenshot({ path: "test-results/j1-09-archived.png" });

  // Verify archive state — immutable badge
  await expect(page.getByText(/archived|frozen|immutable/i)).toBeVisible();

  // Verify audit ledger entry exists
  await page.goto(`/engagements/${engagementId}/ledger`);
  await expect(page.getByText(/archive.*event|file.*frozen/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j1-10-ledger.png" });
});
