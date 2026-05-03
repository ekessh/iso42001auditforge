// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
/**
 * Journey 5 — Agent Trace Ingest → Analysis → Tool ACL Drift Finding
 *
 * Validates the agentic workflow auditor:
 * 1. Import OTel/Langfuse agent trace
 * 2. Analyze trace (timeline, tool calls, decisions)
 * 3. Tool permission drift detector identifies declared vs actual discrepancy
 * 4. Raise finding from drift detection
 *
 * @tags @critical @journey @nightly
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import { TraceAnalyzerPage, assertPageLCP } from "../helpers/page-objects";

const LEAD_AUTH_STATE = "test-results/auth-lead_auditor.json";
const ENGAGEMENT_ID = "00000000-0004-0000-0000-000000000001";
const AI_SYSTEM_AGENT_ID = "00000000-0005-0000-0000-000000000002";

// Fixture: FraudDetect-Agent trace with a tool ACL drift (called 'db:delete' not in declared ACL)
const AGENT_TRACE_WITH_DRIFT = path.resolve(
  __dirname,
  "../../fixtures/agent-traces/frauddetect-acl-drift.otel.json",
);
const AGENT_TRACE_CLEAN = path.resolve(
  __dirname,
  "../../fixtures/agent-traces/frauddetect-clean.otel.json",
);

test.use({ storageState: LEAD_AUTH_STATE });

test("J5a: ingest OTel trace, analyze, identify tool ACL drift, raise finding", async ({ page }) => {
  // ── Step 1: Navigate to trace analyzer ───────────────────────────────
  const traceAnalyzer = new TraceAnalyzerPage(page);
  await traceAnalyzer.goto(ENGAGEMENT_ID, AI_SYSTEM_AGENT_ID);
  await assertPageLCP(page);
  await page.screenshot({ path: "test-results/j5-01-trace-analyzer.png" });

  // ── Step 2: Import agent trace ────────────────────────────────────────
  await traceAnalyzer.importTrace(AGENT_TRACE_WITH_DRIFT);
  await page.screenshot({ path: "test-results/j5-02-trace-imported.png" });

  // Verify trace appears in list
  await expect(page.getByTestId("trace-list")).toContainText(/frauddetect|FraudDetect/i);

  // ── Step 3: Analyze the trace ─────────────────────────────────────────
  const traceId = await page.getByTestId("trace-list").locator('[data-testid^="trace-"]').first().getAttribute("data-trace-id") ?? "latest";
  await traceAnalyzer.analyzeTrace(traceId);
  await page.screenshot({ path: "test-results/j5-03-trace-analyzed.png" });

  // Verify timeline is shown
  await expect(page.getByTestId("trace-timeline")).toBeVisible();

  // Check span count
  const spanCount = await page.getByTestId("span-count").textContent();
  expect(parseInt(spanCount ?? "0")).toBeGreaterThan(0);

  // Verify tool calls are listed
  await page.getByRole("tab", { name: /tool calls/i }).click();
  await expect(page.getByTestId("tool-calls-table")).toBeVisible();
  await page.screenshot({ path: "test-results/j5-04-tool-calls.png" });

  // ── Step 4: Review tool ACL drift ────────────────────────────────────
  const { driftCount } = await traceAnalyzer.reviewToolAclDrift();
  expect(driftCount, "Expected at least 1 ACL drift in the test fixture").toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/j5-05-acl-drift-detected.png" });

  // Verify drift details
  const driftItem = page.getByTestId("acl-drift-item").first();
  await expect(driftItem).toContainText(/db:delete|undeclared/i);
  await expect(driftItem.getByTestId("drift-severity")).toContainText(/high|medium/i);

  // ── Step 5: Raise finding from drift ─────────────────────────────────
  const findingId = await traceAnalyzer.raiseFindingFromDrift(0);
  expect(findingId).toBeTruthy();
  await page.screenshot({ path: "test-results/j5-06-finding-raised.png" });

  // Verify finding is pre-populated with ACL drift details
  await expect(page.getByText(/A\.3|tool.*acl|permission.*drift/i)).toBeVisible();

  // ── Step 6: Verify trace is linked to WP in audit trail ───────────────
  await page.goto(`/engagements/${ENGAGEMENT_ID}/ledger`);
  await expect(page.getByText(/trace.*ingest|trace.*anal/i)).toBeVisible();
  await page.screenshot({ path: "test-results/j5-07-ledger-trace.png" });
});

test("J5b: clean trace — no ACL drift detected", async ({ page }) => {
  const traceAnalyzer = new TraceAnalyzerPage(page);
  await traceAnalyzer.goto(ENGAGEMENT_ID, AI_SYSTEM_AGENT_ID);

  await traceAnalyzer.importTrace(AGENT_TRACE_CLEAN);
  const traceId = await page.getByTestId("trace-list").locator('[data-testid^="trace-"]').first().getAttribute("data-trace-id") ?? "latest";
  await traceAnalyzer.analyzeTrace(traceId);

  const { driftCount } = await traceAnalyzer.reviewToolAclDrift();
  expect(driftCount, "Clean fixture should have no ACL drift").toBe(0);
  await expect(page.getByText(/no.*drift.*detected|all.*tools.*authorised/i)).toBeVisible();
});

test("J5c: large trace performance — 100k spans must load within 10s", async ({ page }) => {
  const traceAnalyzer = new TraceAnalyzerPage(page);
  await traceAnalyzer.goto(ENGAGEMENT_ID, AI_SYSTEM_AGENT_ID);

  const largeTrace = path.resolve(__dirname, "../../fixtures/agent-traces/large-trace-100k-spans.otel.json");
  const start = Date.now();
  await traceAnalyzer.importTrace(largeTrace);
  const traceId = "large-100k";
  await traceAnalyzer.analyzeTrace(traceId);
  const elapsed = Date.now() - start;

  expect(elapsed, `Large trace analysis took ${elapsed}ms, expected < 10000ms`).toBeLessThan(10_000);
  await page.screenshot({ path: "test-results/j5c-large-trace-loaded.png" });
});
