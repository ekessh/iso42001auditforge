// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 7 — Accreditation Auditor → Archived File Access → Signature Verification (Read-Only)
 *
 * Validates the accreditation auditor portal:
 * 1. Accreditation auditor receives read-only access to archived file
 * 2. Can browse all working papers, findings, reports
 * 3. Can verify cryptographic signatures
 * 4. Cannot edit any content
 * 5. Cannot download raw evidence files without authorization
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import { ArchivePortalPage, assertPageLCP } from "../helpers/page-objects";

const ACCRED_AUTH_STATE = "test-results/auth-accreditation_auditor.json";
const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";

test.describe("Journey 7 - Accreditation Auditor Read-Only Access", () => {
  // Pre-condition: grant accreditation auditor access to archived engagement
  test.beforeAll(async ({ browser }) => {
    const leadCtx = await browser.newContext({ storageState: LEAD_AUTH_STATE });
    const leadPage = await leadCtx.newPage();

    await leadPage.goto(`/engagements/${ENGAGEMENT_ID}/access`);
    await leadPage.waitForLoadState("networkidle");

    // Grant access to accred auditor
    await leadPage.getByRole("button", { name: /grant.*access|invite.*accred/i }).click();
    await leadPage.getByRole("combobox", { name: /auditor|user/i }).click();
    await leadPage.getByRole("option", { name: /Dave Accred/i }).click();
    await leadPage.getByRole("radio", { name: /read.only|view.*only/i }).check();
    await leadPage.getByRole("button", { name: /grant|save/i }).click();
    await expect(leadPage.getByText(/access.*granted/i)).toBeVisible();

    await leadCtx.close();
  });

  test("J7a: accreditation auditor views archived file", async ({ browser }) => {
    const accredCtx = await browser.newContext({ storageState: ACCRED_AUTH_STATE });
    const accredPage = await accredCtx.newPage();

    const archivePortal = new ArchivePortalPage(accredPage);
    await archivePortal.goto(ENGAGEMENT_ID);
    await assertPageLCP(accredPage);
    await accredPage.screenshot({ path: "test-results/j7-01-archive-portal.png" });

    // Should see engagement summary
    await expect(accredPage.getByText(/ClientAlpha Corp/i)).toBeVisible();
    await expect(accredPage.getByText(/ISO.*42001|AIMS/i)).toBeVisible();
    await expect(accredPage.getByTestId("archive-frozen-badge")).toBeVisible();

    // ── Read-only verification ────────────────────────────────────────
    await archivePortal.assertReadOnly();
    await accredPage.screenshot({ path: "test-results/j7-02-read-only-confirmed.png" });

    await accredCtx.close();
  });

  test("J7b: accreditation auditor verifies digital signature", async ({ browser }) => {
    const accredCtx = await browser.newContext({ storageState: ACCRED_AUTH_STATE });
    const accredPage = await accredCtx.newPage();

    const archivePortal = new ArchivePortalPage(accredPage);
    await archivePortal.goto(ENGAGEMENT_ID);

    // Verify signature
    const { valid, details } = await archivePortal.verifySignature();
    expect(valid, `Signature should be valid. Details: ${details}`).toBe(true);
    await accredPage.screenshot({ path: "test-results/j7-03-signature-verified.png" });

    // Verify signature details shown
    await expect(accredPage.getByText(/Alice Lead|lead@auditforge/i)).toBeVisible();
    await expect(accredPage.getByTestId("sig-timestamp")).toBeVisible();
    await expect(accredPage.getByTestId("sig-certificate-info")).toBeVisible();

    await accredCtx.close();
  });

  test("J7c: accreditation auditor browses working papers read-only", async ({ browser }) => {
    const accredCtx = await browser.newContext({ storageState: ACCRED_AUTH_STATE });
    const accredPage = await accredCtx.newPage();

    await accredPage.goto(`/archive/${ENGAGEMENT_ID}/working-papers`);
    await accredPage.waitForLoadState("networkidle");
    await assertPageLCP(accredPage);

    // Can see WPs
    await expect(accredPage.getByTestId("wp-list")).toBeVisible();
    const wpCount = await accredPage.getByTestId("wp-list").locator("tr").count();
    expect(wpCount).toBeGreaterThan(1); // At least header + 1 row

    // Click into a WP
    await accredPage.getByTestId("wp-list").locator("tr").nth(1).click();
    await accredPage.waitForLoadState("networkidle");

    // Content is visible
    await expect(accredPage.locator('[data-testid="wp-content"]')).toBeVisible();

    // No edit controls
    await expect(accredPage.getByRole("button", { name: /edit|modify|save/i })).not.toBeVisible();
    await accredPage.screenshot({ path: "test-results/j7-04-wp-readonly.png" });

    await accredCtx.close();
  });

  test("J7d: accreditation auditor views findings", async ({ browser }) => {
    const accredCtx = await browser.newContext({ storageState: ACCRED_AUTH_STATE });
    const accredPage = await accredCtx.newPage();

    await accredPage.goto(`/archive/${ENGAGEMENT_ID}/findings`);
    await accredPage.waitForLoadState("networkidle");

    await expect(accredPage.getByTestId("findings-list")).toBeVisible();
    await accredPage.screenshot({ path: "test-results/j7-05-findings-readonly.png" });

    // Cannot raise new finding
    await expect(accredPage.getByRole("button", { name: /raise|new.*finding/i })).not.toBeVisible();

    await accredCtx.close();
  });

  test("J7e: accreditation auditor cannot access other engagements", async ({ browser }) => {
    const accredCtx = await browser.newContext({ storageState: ACCRED_AUTH_STATE });
    const accredPage = await accredCtx.newPage();

    // Attempt to access a different engagement (not granted access)
    const res = await accredPage.goto(`/archive/99999999-9999-9999-9999-999999999999`);
    expect(res?.status()).toBeOneOf([403, 404]);
    await accredPage.screenshot({ path: "test-results/j7-06-access-denied.png" });

    await accredCtx.close();
  });
});
