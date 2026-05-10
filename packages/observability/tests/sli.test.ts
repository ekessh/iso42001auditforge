// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import {
  SLO_CATALOG,
  generateRecordingRules,
  generateRecordingRulesYaml,
  registerSloAuxiliaryMetrics,
  resetSloAuxiliaryForTests,
} from '../src/sli.js';
import { resetMetricsForTests } from '../src/metrics.js';

describe('SLI catalog', () => {
  beforeEach(() => {
    resetMetricsForTests();
    resetSloAuxiliaryForTests();
  });

  it('declares the four required SLIs', () => {
    const ids = SLO_CATALOG.map((s) => s.id);
    expect(ids).toContain('api.request_success_rate');
    expect(ids).toContain('llm.invocation_success_rate');
    expect(ids).toContain('ledger.append_latency_p99');
    expect(ids).toContain('wp.sync_freshness');
  });

  it('every SLO has objective in (0, 100]', () => {
    for (const s of SLO_CATALOG) {
      expect(s.objectivePct).toBeGreaterThan(0);
      expect(s.objectivePct).toBeLessThanOrEqual(100);
    }
  });

  it('emits 3 recording rules per SLI', () => {
    const rules = generateRecordingRules();
    expect(rules.length).toBe(SLO_CATALOG.length * 3);
  });

  it('YAML rules contain numerator + denominator + objective_pct', () => {
    const yaml = generateRecordingRulesYaml();
    for (const sli of SLO_CATALOG) {
      expect(yaml).toContain(`record: sli:${sli.id}:numerator`);
      expect(yaml).toContain(`record: sli:${sli.id}:denominator`);
      expect(yaml).toContain(`record: sli:${sli.id}:objective_pct`);
    }
  });

  it('registerSloAuxiliaryMetrics is idempotent', () => {
    const a = registerSloAuxiliaryMetrics();
    const b = registerSloAuxiliaryMetrics();
    expect(a.surveillanceIngest).toBe(b.surveillanceIngest);
    expect(a.wpSnapshotAgeSeconds).toBe(b.wpSnapshotAgeSeconds);
  });
});
