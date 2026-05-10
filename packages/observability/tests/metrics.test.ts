// SPDX-License-Identifier: BUSL-1.1
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getMetrics, getRegistry, hashIdToBucket, resetMetricsForTests } from '../src/metrics.js';

describe('metrics registry', () => {
  beforeEach(() => {
    resetMetricsForTests();
  });
  afterEach(() => {
    resetMetricsForTests();
  });

  it('exposes the canonical 19 named series', async () => {
    const m = getMetrics();
    const text = await m.registry.metrics();
    const expectedNames = [
      'auditforge_http_request_duration_ms',
      'auditforge_db_query_duration_ms',
      'auditforge_llm_call_duration_ms',
      'auditforge_llm_call_cost_usd_total',
      'auditforge_probe_duration_ms',
      'auditforge_probe_budget_used_usd',
      'auditforge_ledger_chain_verify_ms',
      'auditforge_ledger_emit_total',
      'auditforge_ledger_emit_failures_total',
      'auditforge_retrieval_latency_ms',
      'auditforge_attribution_precision',
      'auditforge_claim_extraction_f1',
      'auditforge_contradiction_precision',
      'auditforge_rls_bypass_total',
      'auditforge_av_scan_enabled',
      'auditforge_probe_queue_depth',
      'auditforge_signature_renewal_success_total',
      'auditforge_signature_renewal_failure_total',
      'auditforge_backup_age_seconds',
    ];
    expect(expectedNames).toHaveLength(19);
    for (const _name of expectedNames) {
      // Each metric registers HELP and TYPE lines even with zero samples, EXCEPT counters,
      // which only emit on first inc(). Touch them.
    }
    // Touch counters so they materialise.
    m.llmCallCost.inc({ provider: 'a', model: 'b', engagement_hashed: '0' }, 0);
    m.ledgerEmitTotal.inc({ event_type: 't', status: 'ok' }, 0);
    m.ledgerEmitFailures.inc({ event_type: 't', reason: 'r' }, 0);
    m.rlsBypassAttempts.inc({ table: 't' }, 0);
    m.signatureRenewalSuccess.inc(0);
    m.signatureRenewalFailure.inc({ reason: 'r' }, 0);

    const text2 = await m.registry.metrics();
    for (const name of expectedNames) {
      expect(text2).toContain(`# HELP ${name}`);
    }
    expect(text2.length).toBeGreaterThan(text.length - 1);
  });

  it('is idempotent: getMetrics returns the same registry on every call', () => {
    const m1 = getMetrics();
    const m2 = getMetrics();
    expect(m1).toBe(m2);
    expect(getRegistry()).toBe(m1.registry);
  });

  it('hashIdToBucket returns deterministic values in [0, n)', () => {
    const a = hashIdToBucket('engagement-1234', 64);
    const b = hashIdToBucket('engagement-1234', 64);
    expect(a).toBe(b);
    const n = Number.parseInt(a, 10);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(64);
  });

  it('observe / inc helpers accept the documented label sets without throwing', () => {
    const m = getMetrics();
    expect(() => {
      m.requestDuration.observe(
        { route: '/x', method: 'GET', status: '200', firm_id_hashed: '12' },
        42,
      );
      m.dbQueryDuration.observe({ query_type: 'SELECT', table: 'findings' }, 7);
      m.llmCallDuration.observe({ provider: 'oai', model: 'gpt-4', task: 'draft' }, 100);
      m.llmCallCost.inc({ provider: 'oai', model: 'gpt-4', engagement_hashed: '1' }, 0.05);
      m.probeDuration.observe({ probe_id: 'p1', mode: 'sandbox' }, 250);
      m.probeBudgetUsed.set({ engagement_hashed: '1' }, 12.5);
      m.ledgerChainVerifyMs.observe(80);
      m.ledgerEmitTotal.inc({ event_type: 'finding.created', status: 'ok' });
      m.ledgerEmitFailures.inc({ event_type: 'finding.created', reason: 'db' });
      m.retrievalLatency.observe({ source: 'corpus' }, 60);
      m.attributionPrecision.set({ release: 'v1.0.0' }, 0.92);
      m.claimExtractionF1.set({ release: 'v1.0.0' }, 0.81);
      m.contradictionPrecision.set({ release: 'v1.0.0' }, 0.77);
      m.rlsBypassAttempts.inc({ table: 'findings' });
      m.avScanEnabled.set(1);
      m.probeQueueDepth.set({ queue: 'probes' }, 0);
      m.signatureRenewalSuccess.inc();
      m.signatureRenewalFailure.inc({ reason: 'tsa-timeout' });
      m.backupAge.set(3600);
    }).not.toThrow();
  });
});
