// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 3 — Auditee Plan Receipt → Evidence Upload → CAPA Submit → Close
 *
 * Validates the auditee portal flow:
 * 1. Auditee receives plan notification
 * 2. Auditee views the audit plan
 * 3. Auditee receives findings after audit
 * 4. Auditee uploads CAPA evidence
 * 5. Auditee submits corrective action
 * 6. Lead auditor reviews and closes NC
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import { AuditeePortalPage, FindingsPage, assertPageLCP } from "../helpers/page-objects";

const AUDITEE_AUTH_STATE = "test-results/auth-auditee_user.json";
const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";
const SAMPLE_EVIDENCE_PATH = path.resolve(__dirname, "../../fixtures/reports/sample-evidence.pdf");

test.describe("Journey 3 - Auditee CAPA flow", () => {
  let findingId: string;

  // Pre-condition: Lead auditor raises a finding that needs CAPA
  test.beforeEach(async ({ browser }) => {
    const leadCtx = await browser.newContext({
      storageState: LEAD_AUTH_STATE,
    });
    const leadPage = await leadCtx.newPage();

    await leadPage.goto(`/engagements/${ENGAGEMENT_ID}/findings/new`);
    await leadPage.waitForLoadState("networkidle");

    await leadPage.getByRole("radio", { name: /minor.*nc/i }).check();
    await leadPage.getByRole("combobox", { name: /clause/i }).click();
    await leadPage.getByRole("option", { name: /6\.1.*risks.*opportunities/i }).click();
    await leadPage.getByLabel(/statement/i).fill(
      "The AIMS risk assessment does not address all AI-specific risk categories as required by clause 6.1.2. " +
        "Specifically, risks related to data bias and model drift are not documented.",
    );
    await leadPage.getByLabel(/evidence/i).fill("Risk register v3.2, reviewed 2024-03-01");
    await leadPage.getByRole("button", { name: /save|raise/i }).click();
    await leadPage.waitForURL(/\/findings\/[a-z0-9-]+/);

    findingId = leadPage.url().split("/findings/")[1]?.split("/")[0] ?? "";
    expect(findingId).toBeTruthy();

    // Notify auditee (sends portal notification)
    await leadPage.getByRole("button", { name: /notify.*auditee|send.*finding/i }).click();
    await leadPage.getByRole("button", { name: /confirm|send/i }).click();
    await leadCtx.close();
  });

  test("J3a: auditee views plan in portal", async ({ browser }) => {
    const auditeeCtx = await browser.newContext({ storageState: AUDITEE_AUTH_STATE });
    const auditeeP = await auditeeCtx.newPage();

    const portal = new AuditeePortalPage(auditeeP);
    await portal.goto();
    await assertPageLCP(auditeeP);

    // Should see notification about audit plan
    await expect(auditeeP.getByText(/audit plan|plan.*received/i)).toBeVisible();
    await auditeeP.screenshot({ path: "test-results/j3-01-auditee-portal.png" });

    // View the plan
    await auditeeP.getByRole("link", { name: /view.*plan|audit plan/i }).first().click();
    await auditeeP.waitForLoadState("networkidle");

    // Verify plan contents visible (read-only)
    await expect(auditeeP.getByText(/Opening Meeting|Stage 2/i)).toBeVisible();
    await auditeeP.screenshot({ path: "test-results/j3-02-auditee-views-plan.png" });

    // Verify auditee cannot edit the plan
    await expect(auditeeP.getByRole("button", { name: /edit.*plan|modify/i })).not.toBeVisible();

    await auditeeCtx.close();
  });

  test("J3b: auditee receives finding, uploads evidence, submits CAPA", async ({ browser }) => {
    const auditeeCtx = await browser.newContext({ storageState: AUDITEE_AUTH_STATE });
    const auditeeP = await auditeeCtx.newPage();

    const portal = new AuditeePortalPage(auditeeP);
    await portal.goto();

    // Navigate to findings
    await auditeeP.getByRole("link", { name: /findings|non.conformities/i }).click();
    await auditeeP.waitForLoadState("networkidle");

    // Should see the finding
    await expect(auditeeP.getByText(/6\.1.*risks/i)).toBeVisible();
    await auditeeP.screenshot({ path: "test-results/j3-03-auditee-views-finding.png" });

    // Upload evidence as CAPA supporting documentation
    await portal.uploadEvidence(findingId, SAMPLE_EVIDENCE_PATH);
    await auditeeP.screenshot({ path: "test-results/j3-04-evidence-uploaded.png" });

    // Submit CAPA
    await portal.submitCapa(
      findingId,
      "Root Cause: The risk assessment procedure (ISMS-PROC-006) was developed before the AIMS was established " +
        "and did not include AI-specific risk categories.\n\n" +
        "Corrective Action: Updated risk assessment procedure to include AI-specific categories including " +
        "data bias, model drift, prompt injection, and output quality degradation. " +
        "New risk assessment completed using updated procedure. Evidence attached.\n\n" +
        "Target Completion: 2024-04-15",
    );
    await auditeeP.screenshot({ path: "test-results/j3-05-capa-submitted.png" });

    // Verify CAPA status
    await expect(auditeeP.getByText(/capa.*submitted|under.*review/i)).toBeVisible();

    await auditeeCtx.close();
  });

  test("J3c: lead auditor reviews CAPA and closes NC", async ({ browser }) => {
    // Lead auditor reviews the submitted CAPA
    const leadCtx = await browser.newContext({ storageState: LEAD_AUTH_STATE });
    const leadP = await leadCtx.newPage();

    await leadP.goto(`/engagements/${ENGAGEMENT_ID}/findings/${findingId}`);
    await leadP.waitForLoadState("networkidle");

    // Verify CAPA is visible
    await expect(leadP.getByText(/capa.*submitted|corrective action/i)).toBeVisible();
    await leadP.screenshot({ path: "test-results/j3-06-lead-reviews-capa.png" });

    // Review evidence
    await leadP.getByRole("tab", { name: /evidence|attachments/i }).click();
    await expect(leadP.getByText(/sample-evidence|\.pdf/i)).toBeVisible();

    // Accept CAPA
    await leadP.getByRole("button", { name: /accept.*capa|approve.*action/i }).click();
    await leadP.getByLabel(/verification notes/i).fill(
      "CAPA reviewed. Updated risk assessment procedure confirmed. " +
        "New risk register reviewed and accepted. NC closed.",
    );
    await leadP.getByRole("button", { name: /close.*nc|close.*finding/i }).click();
    await leadP.waitForLoadState("networkidle");

    // Verify NC is closed
    await expect(leadP.getByText(/closed|resolved/i)).toBeVisible();
    await leadP.screenshot({ path: "test-results/j3-07-nc-closed.png" });

    // Verify ledger entry
    await leadP.goto(`/engagements/${ENGAGEMENT_ID}/ledger`);
    await expect(leadP.getByText(/nc.*closed|finding.*closed/i)).toBeVisible();
    await leadP.screenshot({ path: "test-results/j3-08-ledger-nc-closed.png" });

    await leadCtx.close();
  });
});
