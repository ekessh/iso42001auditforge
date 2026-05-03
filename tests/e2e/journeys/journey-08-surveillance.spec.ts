// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 8 — Continuous Surveillance Threshold Breach → Ad-hoc Audit Consideration
 *
 * Validates the surveillance module:
 * 1. Auditor configures surveillance thresholds for a client
 * 2. Auditee telemetry hook sends metrics
 * 3. A metric breaches the configured threshold
 * 4. Alert is raised in the auditor's dashboard
 * 5. Auditor reviews and marks as "ad-hoc audit consideration"
 * 6. Ad-hoc audit consideration appears in next audit planning
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import { SurveillanceDashboardPage, assertPageLCP } from "../helpers/page-objects";

const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";

test.use({ storageState: LEAD_AUTH_STATE });

test("J8a: configure surveillance threshold for drift metric", async ({ page }) => {
  await page.goto(`/engagements/${ENGAGEMENT_ID}/surveillance/configure`);
  await page.waitForLoadState("networkidle");
  await assertPageLCP(page);

  // Configure a threshold for model drift metric
  await page.getByRole("button", { name: /add.*threshold|new.*threshold/i }).click();
  await page.getByRole("combobox", { name: /metric/i }).click();
  await page.getByRole("option", { name: /drift|distribution.*drift/i }).click();
  await page.getByLabel(/threshold.*value|limit/i).fill("0.15");
  await page.getByRole("combobox", { name: /direction/i }).click();
  await page.getByRole("option", { name: /greater.*than|above/i }).click();
  await page.getByLabel(/alert.*name|threshold.*name/i).fill("Model Drift Alert - CreditRisk-v3");
  await page.getByRole("button", { name: /save.*threshold|create/i }).click();

  await expect(page.getByText(/threshold.*saved|created.*threshold/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j8-01-threshold-configured.png" });
});

test("J8b: threshold breach triggers alert", async ({ page }) => {
  const surveillance = new SurveillanceDashboardPage(page);
  await surveillance.goto(ENGAGEMENT_ID);
  await assertPageLCP(page);

  // Inject a metric that breaches the threshold (test-only endpoint)
  await surveillance.triggerThresholdBreach("model_drift_creditrisk_v3", 0.32);
  await page.screenshot({ path: "test-results/j8-02-alert-triggered.png" });

  // Alert should show metric value and threshold
  const alert = page.getByRole("alert", { name: /threshold.*breach|drift.*alert/i });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/0\.32/);
  await expect(alert).toContainText(/0\.15.*threshold|threshold.*0\.15/i);
});

test("J8c: auditor escalates to ad-hoc audit consideration", async ({ page }) => {
  const surveillance = new SurveillanceDashboardPage(page);
  await surveillance.goto(ENGAGEMENT_ID);

  // Find the breach alert
  const alert = page.getByTestId("surveillance-alert").filter({ hasText: /drift|CreditRisk/i }).first();
  await expect(alert).toBeVisible();

  // Mark as ad-hoc audit consideration
  await alert.getByRole("button", { name: /consider.*audit|escalate|ad.hoc/i }).click();
  await page.getByLabel(/rationale|reason/i).fill(
    "Drift score of 0.32 significantly exceeds 0.15 threshold, indicating potential model decay. " +
      "Recommend ad-hoc audit to assess control effectiveness before next scheduled surveillance.",
  );
  await page.getByLabel(/priority/i).selectOption("high");
  await page.getByRole("button", { name: /confirm|save/i }).click();

  await expect(page.getByText(/ad.hoc.*consideration.*created|escalated/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j8-03-adhoc-consideration.png" });
});

test("J8d: ad-hoc audit consideration visible in next audit planning", async ({ page }) => {
  // Navigate to surveillance ad-hoc considerations list
  await page.goto(`/engagements/${ENGAGEMENT_ID}/surveillance/considerations`);
  await page.waitForLoadState("networkidle");
  await assertPageLCP(page);

  await expect(page.getByText(/drift|CreditRisk/i)).toBeVisible();
  await expect(page.getByTestId("consideration-priority")).toContainText(/high/i);
  await page.screenshot({ path: "test-results/j8-04-consideration-listed.png" });

  // Create next surveillance engagement — consideration should pre-populate
  await page.getByRole("button", { name: /plan.*surveillance|schedule.*audit/i }).click();
  await page.waitForURL(/\/engagements\/[a-z0-9-]+(\/plan)?/);
  await assertPageLCP(page);

  // Consideration should appear as pre-seeded area of focus
  await expect(page.getByText(/model drift|CreditRisk|ad.hoc.*consideration/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j8-05-consideration-in-plan.png" });
});

test("J8e: surveillance telemetry replay attack — replayed metric is rejected", async ({ request }) => {
  const apiUrl = process.env["E2E_API_URL"] ?? "http://localhost:3001";

  // Get a valid telemetry token first
  const tokenRes = await request.post(`${apiUrl}/api/v1/surveillance/telemetry-token`, {
    data: { engagementId: ENGAGEMENT_ID },
  });
  expect(tokenRes.ok()).toBe(true);
  const { token, nonce } = (await tokenRes.json()) as { token: string; nonce: string };

  // Submit a legitimate metric
  const metricPayload = {
    engagementId: ENGAGEMENT_ID,
    metric: "model_drift_creditrisk_v3",
    value: 0.08,
    timestamp: new Date().toISOString(),
    nonce,
  };

  const firstSubmit = await request.post(`${apiUrl}/api/v1/surveillance/telemetry`, {
    headers: { Authorization: `Bearer ${token}` },
    data: metricPayload,
  });
  expect(firstSubmit.ok()).toBe(true);

  // Replay the same payload with the same nonce — should be rejected
  const replaySubmit = await request.post(`${apiUrl}/api/v1/surveillance/telemetry`, {
    headers: { Authorization: `Bearer ${token}` },
    data: metricPayload, // same nonce!
  });
  expect(replaySubmit.status()).toBe(409); // Conflict — nonce already used
});
