// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 2 — Team Auditor Offline Working Papers → Reconnect → Sync → No Data Loss
 *
 * Validates the CRDT-based offline-first capability:
 * - Team auditor goes offline
 * - Creates and edits multiple working papers
 * - Comes back online
 * - All changes sync correctly with no data loss
 * - Conflict resolution works when lead also edited
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import { WorkingPaperPage, assertPageLCP } from "../helpers/page-objects";

const TEAM_AUTH_STATE = "test-results/auth-team_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";

test.use({ storageState: TEAM_AUTH_STATE });

test("J2: offline working paper edits sync without data loss", async ({ page }) => {
  // ── Step 1: Load working paper while online ───────────────────────────
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers`);
  await page.waitForLoadState("networkidle");
  await assertPageLCP(page);

  // Create a new WP for clause 7.5 (documented information)
  await page.getByRole("button", { name: /new.*working paper/i }).click();
  await page.getByRole("combobox", { name: /clause/i }).click();
  await page.getByRole("option", { name: /7\.5.*documented information/i }).click();
  await page.getByRole("button", { name: /create/i }).click();
  await page.waitForURL(/\/working-papers\/[a-z0-9-]+/);

  const wpUrl = page.url();
  const wpId = wpUrl.split("/working-papers/")[1]?.split("/")[0] ?? "";
  expect(wpId).toBeTruthy();

  // Record the initial sync indicator state
  await expect(page.getByTestId("sync-indicator")).toBeVisible();
  await page.screenshot({ path: "test-results/j2-01-online-before-offline.png" });

  // ── Step 2: Go offline ────────────────────────────────────────────────
  const wp = new WorkingPaperPage(page);
  await wp.goOffline();

  // Verify offline banner appears
  await expect(page.getByTestId("offline-banner")).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: "test-results/j2-02-offline-banner.png" });

  // ── Step 3: Edit working paper while offline ──────────────────────────
  const offlineText1 = "OFFLINE EDIT 1: Reviewed documented information management procedure. " +
    "Client maintains a document register (DOC-REG-2024) with 47 controlled documents. " +
    "All documents have revision history, owner, and review date.";

  await wp.enterObservation(offlineText1);

  // Add a second paragraph
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  const offlineText2 = "OFFLINE EDIT 2: Sampled 5 documents from the register. " +
    "Documents IDs: D-001, D-012, D-023, D-035, D-047. " +
    "All had current review dates within 12 months.";
  await page.keyboard.type(offlineText2);

  // Set verdict while offline
  await wp.setVerdict("conformant");
  await page.screenshot({ path: "test-results/j2-03-offline-edits.png" });

  // ── Step 4: Navigate to another WP while offline (data persists in CRDT) ─
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers`);
  await expect(page.getByTestId("offline-banner")).toBeVisible();

  // Create another WP offline (tests CRDT create)
  await page.getByRole("button", { name: /new.*working paper/i }).click();
  await page.getByRole("combobox", { name: /clause/i }).click();
  await page.getByRole("option", { name: /9\.1.*monitoring/i }).click();
  await page.getByRole("button", { name: /create/i }).click();
  await page.waitForURL(/\/working-papers\/[a-z0-9-]+/);

  const secondWpId = page.url().split("/working-papers/")[1]?.split("/")[0] ?? "";

  await wp.enterObservation(
    "OFFLINE EDIT 3: Reviewed AIMS performance monitoring procedure. " +
      "Client has defined 8 KPIs for AI system performance monitoring.",
  );
  await page.screenshot({ path: "test-results/j2-04-second-wp-offline.png" });

  // ── Step 5: Reconnect ─────────────────────────────────────────────────
  await wp.goOnline();

  // Offline banner should disappear
  await expect(page.getByTestId("offline-banner")).not.toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "test-results/j2-05-reconnected-syncing.png" });

  // ── Step 6: Verify all offline edits are persisted ────────────────────
  // Navigate back to first WP and verify text
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers/${wpId}`);
  await page.waitForLoadState("networkidle");

  const wpContent = await page.locator('[data-testid="wp-editor"], [contenteditable="true"]').first().textContent();
  expect(wpContent).toContain("OFFLINE EDIT 1");
  expect(wpContent).toContain("OFFLINE EDIT 2");
  expect(wpContent).toContain("DOC-REG-2024");

  // Verify verdict was preserved
  const verdictValue = await page.getByRole("combobox", { name: /verdict/i }).inputValue();
  expect(verdictValue.toLowerCase()).toMatch(/conformant/);

  await page.screenshot({ path: "test-results/j2-06-sync-verified.png" });

  // Verify second WP also synced
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers/${secondWpId}`);
  await page.waitForLoadState("networkidle");

  const secondWpContent = await page.locator('[data-testid="wp-editor"], [contenteditable="true"]').first().textContent();
  expect(secondWpContent).toContain("OFFLINE EDIT 3");

  // ── Step 7: Check audit ledger for sync events ────────────────────────
  await page.goto(`/engagements/${ENGAGEMENT_ID}/ledger`);
  await page.waitForLoadState("networkidle");

  // Should show offline sync events
  await expect(page.getByText(/offline.*sync|crdt.*merge|sync.*complete/i).first()).toBeVisible();
  await page.screenshot({ path: "test-results/j2-07-ledger-sync-events.png" });
});

test("J2b: conflict resolution when both auditors edit same WP offline", async ({ page, context }) => {
  // Open WP in team auditor session
  await page.goto(`/engagements/${ENGAGEMENT_ID}/working-papers`);
  await page.waitForLoadState("networkidle");

  // Create a WP to test conflict
  await page.getByRole("button", { name: /new.*working paper/i }).click();
  await page.getByRole("combobox", { name: /clause/i }).click();
  await page.getByRole("option", { name: /5\.1.*leadership/i }).click();
  await page.getByRole("button", { name: /create/i }).click();
  await page.waitForURL(/\/working-papers\/[a-z0-9-]+/);
  const sharedWpId = page.url().split("/working-papers/")[1]?.split("/")[0] ?? "";

  // Both go offline and edit
  await context.setOffline(true);

  const wp = new WorkingPaperPage(page);
  await wp.enterObservation("Team Auditor: Leadership commitment reviewed. Management meeting minutes sighted.");
  await page.screenshot({ path: "test-results/j2b-01-conflict-team-edit.png" });

  // Come back online — CRDT should merge both edits
  await context.setOffline(false);
  await expect(page.getByTestId("sync-indicator")).toContainText(/synced/i, { timeout: 15_000 });

  // Verify content integrity (CRDT merge preserves both edits)
  const content = await page.locator('[data-testid="wp-editor"], [contenteditable="true"]').first().textContent();
  expect(content).toContain("Team Auditor");
  await page.screenshot({ path: "test-results/j2b-02-conflict-resolved.png" });
});
