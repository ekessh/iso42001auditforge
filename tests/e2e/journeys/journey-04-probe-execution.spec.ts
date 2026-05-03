// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 4 — Probe Execution (Offline + Live + Replay) → WP Linkage → Finding
 *
 * Validates the technical AI assessment runner:
 * 1. Auditor selects probes for the AI system
 * 2. Runs probes in offline mode (test-set based)
 * 3. Views probe results
 * 4. Links results to working paper
 * 5. Raises finding from probe result
 * 6. Verifies probe audit trail
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import { ProbeRunnerPage, WorkingPaperPage, FindingsPage, assertPageLCP } from "../helpers/page-objects";

const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";
const AI_SYSTEM_MODEL_ID = "00000000-0005-0000-0000-000000000001";
const PROBE_TEST_SET = path.resolve(__dirname, "../../fixtures/probe-executions/creditrisk-offline-testset.json");

test.use({ storageState: LEAD_AUTH_STATE });

test("J4a: offline probe execution with bias check and WP linkage", async ({ page }) => {
  // ── Step 1: Navigate to probe runner ─────────────────────────────────
  const probeRunner = new ProbeRunnerPage(page);
  await probeRunner.goto(ENGAGEMENT_ID, AI_SYSTEM_MODEL_ID);
  await assertPageLCP(page);
  await page.screenshot({ path: "test-results/j4-01-probe-runner.png" });

  // ── Step 2: Select probes ─────────────────────────────────────────────
  await probeRunner.selectProbe("P-BIAS-01");
  await probeRunner.selectProbe("P-BIAS-02");
  await probeRunner.selectProbe("P-HALL-01");

  // Verify probe details shown
  await expect(page.getByText(/demographic parity/i)).toBeVisible();
  await expect(page.getByText(/equalized odds/i)).toBeVisible();

  // ── Step 3: Set to offline mode with test set ─────────────────────────
  await probeRunner.setExecutionMode("offline");

  // Upload the test set fixture
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /upload.*test.*set|choose.*test.*set/i }).click(),
  ]);
  await fileChooser.setFiles(PROBE_TEST_SET);
  await page.waitForSelector('[data-testid="testset-loaded"]', { timeout: 15_000 });
  await page.screenshot({ path: "test-results/j4-02-testset-loaded.png" });

  // ── Step 4: Run probes ────────────────────────────────────────────────
  await probeRunner.runSelectedProbes();
  await page.screenshot({ path: "test-results/j4-03-probe-results.png" });

  // Verify results are displayed
  await expect(page.getByTestId("probe-result-P-BIAS-01")).toBeVisible();
  await expect(page.getByTestId("probe-result-P-BIAS-02")).toBeVisible();

  // The fixture has a known demographic parity gap — should FAIL
  const biasResult = page.getByTestId("probe-result-P-BIAS-01");
  await expect(biasResult.getByTestId("result-status")).toContainText(/fail|non.conform/i);
  await expect(biasResult.getByTestId("result-metric")).toBeVisible();

  // ── Step 5: Inspect probe audit trail ────────────────────────────────
  await biasResult.getByRole("button", { name: /view.*trail|audit.*trail/i }).click();
  await expect(page.getByText(/executed by|timestamp|raw.*response/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j4-04-probe-trail.png" });
  await page.keyboard.press("Escape");

  // ── Step 6: Link result to working paper ─────────────────────────────
  // First create a WP for Annex A.5.4 (AI impact assessments / fairness)
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers/new`);
  await page.getByRole("combobox", { name: /clause|control/i }).click();
  await page.getByRole("option", { name: /A\.5\.4|impact.*assess/i }).click();
  await page.getByRole("button", { name: /create/i }).click();
  await page.waitForURL(/\/working-papers\/[a-z0-9-]+/);
  const wpId = page.url().split("/working-papers/")[1]?.split("/")[0] ?? "";

  // Go back to probe results and link
  await page.goto(`/engagements/${ENGAGEMENT_ID}/ai-systems/${AI_SYSTEM_MODEL_ID}/probes`);
  await probeRunner.linkResultToWorkingPaper("last-P-BIAS-01", wpId);
  await page.screenshot({ path: "test-results/j4-05-probe-linked-to-wp.png" });

  // ── Step 7: Raise finding from probe result ───────────────────────────
  await page.getByTestId("probe-result-P-BIAS-01").getByRole("button", { name: /raise.*finding|create.*nc/i }).click();

  // Pre-filled from probe result
  await expect(page.getByLabel(/statement/i)).toContainText(/demographic parity/i);
  await page.getByRole("radio", { name: /major.*nc/i }).check();
  await page.getByRole("button", { name: /save|raise/i }).click();
  await page.waitForURL(/\/findings\/[a-z0-9-]+/);

  const findingId = page.url().split("/findings/")[1]?.split("/")[0] ?? "";
  expect(findingId).toBeTruthy();
  await page.screenshot({ path: "test-results/j4-06-finding-from-probe.png" });

  // Verify finding links back to probe execution
  await expect(page.getByText(/P-BIAS-01|probe.*result/i)).toBeVisible();
});

test("J4b: replay mode probe — analyze existing trace logs", async ({ page }) => {
  const probeRunner = new ProbeRunnerPage(page);
  await probeRunner.goto(ENGAGEMENT_ID, AI_SYSTEM_MODEL_ID);

  // Select drift detection probe
  await probeRunner.selectProbe("P-DRIFT-01");
  await probeRunner.setExecutionMode("replay");

  // Upload production trace for replay analysis
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /upload.*logs|choose.*traces/i }).click(),
  ]);
  await fileChooser.setFiles(
    path.resolve(__dirname, "../../fixtures/agent-traces/creditrisk-production-logs.json"),
  );
  await page.waitForSelector('[data-testid="replay-data-loaded"]', { timeout: 15_000 });

  await probeRunner.runSelectedProbes();

  // Verify drift analysis result
  await expect(page.getByTestId("probe-result-P-DRIFT-01")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "test-results/j4b-01-replay-probe-result.png" });
});
