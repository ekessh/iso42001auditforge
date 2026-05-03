// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { RiskScoreEngine, type RiskInputs } from '../src/risk-score-engine.js';
import type {
  IncidentRecord,
  SurveillanceAlert,
  TelemetryPayload,
} from '../src/domain.js';

const TIME = '2026-05-03T12:00:00.000Z';

const baseInputs: RiskInputs = {
  rescoreId: 'rs1',
  tenantId: 't1',
  engagementId: 'eng1',
  baselineScore: 30,
  alerts: [],
  incidents: [],
  computedAt: TIME,
};

describe('RiskScoreEngine — determinism', () => {
  it('produces identical outputs for identical inputs', () => {
    const e = new RiskScoreEngine();
    const r1 = e.rescore(baseInputs);
    const r2 = e.rescore(baseInputs);
    expect(r1).toEqual(r2);
  });

  it('contributors sorted deterministically regardless of alert order', () => {
    const e = new RiskScoreEngine();
    const alerts: SurveillanceAlert[] = [
      { alertId: 'a', tenantId: 't1', streamId: 's', thresholdId: 'th', severity: 'critical', metricType: 'latency', observedValue: 1, boundary: 0, op: 'gt', raisedAt: TIME, context: {} },
      { alertId: 'b', tenantId: 't1', streamId: 's', thresholdId: 'th', severity: 'warning', metricType: 'drift_indicator', observedValue: 1, boundary: 0, op: 'gt', raisedAt: TIME, context: {} },
    ];
    const r1 = e.rescore({ ...baseInputs, alerts });
    const r2 = e.rescore({ ...baseInputs, alerts: [...alerts].reverse() });
    expect(r1.contributors).toEqual(r2.contributors);
  });
});

describe('RiskScoreEngine — bands & clamping', () => {
  it('classifies low band when no inputs', () => {
    const e = new RiskScoreEngine();
    const r = e.rescore({ ...baseInputs, baselineScore: 5 });
    expect(r.level).toBe('low');
    expect(r.score).toBe(5);
  });

  it('classifies critical band when score >> 80', () => {
    const e = new RiskScoreEngine();
    const r = e.rescore({ ...baseInputs, baselineScore: 90 });
    expect(r.level).toBe('critical');
  });

  it('clamps score to [0,100]', () => {
    const e = new RiskScoreEngine();
    const incidents: IncidentRecord[] = Array.from({ length: 20 }, (_, i) => ({
      incidentId: `i${i}`,
      tenantId: 't1',
      engagementId: 'eng1',
      kind: 'safety',
      severity: 'critical',
      title: 'x',
      summary: 'x',
      occurredAt: TIME,
      reportedAt: TIME,
      affectedSystemIds: [],
      resolved: false,
    }));
    const r = e.rescore({ ...baseInputs, baselineScore: 95, incidents });
    expect(r.score).toBe(100);
    expect(r.level).toBe('critical');
  });
});

describe('RiskScoreEngine — alert weighting', () => {
  it('critical alert weighs more than warning', () => {
    const e = new RiskScoreEngine();
    const warn: SurveillanceAlert = {
      alertId: 'a', tenantId: 't1', streamId: 's', thresholdId: 'th',
      severity: 'warning', metricType: 'latency',
      observedValue: 1, boundary: 0, op: 'gt', raisedAt: TIME, context: {},
    };
    const crit = { ...warn, alertId: 'b', severity: 'critical' as const };
    const wScore = e.rescore({ ...baseInputs, alerts: [warn] }).score;
    const cScore = e.rescore({ ...baseInputs, alerts: [crit] }).score;
    expect(cScore).toBeGreaterThan(wScore);
  });
});

describe('RiskScoreEngine — incident weighting', () => {
  it('resolved incidents have less weight than open ones', () => {
    const e = new RiskScoreEngine();
    const open: IncidentRecord = {
      incidentId: 'i1', tenantId: 't1', engagementId: 'eng1',
      kind: 'safety', severity: 'high', title: 't', summary: 's',
      occurredAt: TIME, reportedAt: TIME, affectedSystemIds: [], resolved: false,
    };
    const closed = { ...open, incidentId: 'i2', resolved: true };
    const a = e.rescore({ ...baseInputs, incidents: [open] }).score;
    const b = e.rescore({ ...baseInputs, incidents: [closed] }).score;
    expect(a).toBeGreaterThan(b);
  });
});

describe('RiskScoreEngine — telemetry contributors', () => {
  it('drift adds to score when mean drift > threshold', () => {
    const e = new RiskScoreEngine();
    const tele: TelemetryPayload[] = [
      {
        id: 'p1', tenantId: 't1', streamId: 's', occurredAt: TIME,
        metric: { type: 'drift_indicator', feature: 'f', method: 'psi', score: 0.5, baselineWindowDays: 30 },
      },
      {
        id: 'p2', tenantId: 't1', streamId: 's', occurredAt: TIME,
        metric: { type: 'drift_indicator', feature: 'f', method: 'psi', score: 0.5, baselineWindowDays: 30 },
      },
    ];
    const r = e.rescore({ ...baseInputs, telemetry: tele });
    expect(r.contributors.find((c) => c.source === 'telemetry:drift_mean')).toBeDefined();
    expect(r.score).toBeGreaterThan(baseInputs.baselineScore);
  });

  it('safety eval shortfall increases score', () => {
    const e = new RiskScoreEngine();
    const tele: TelemetryPayload[] = [
      {
        id: 'p1', tenantId: 't1', streamId: 's', occurredAt: TIME,
        metric: { type: 'safety_eval', suiteId: 'su', passRate: 0.5, sampleSize: 100 },
      },
    ];
    const r = e.rescore({ ...baseInputs, telemetry: tele });
    expect(r.contributors.find((c) => c.source === 'telemetry:safety_eval')).toBeDefined();
    expect(r.score).toBeGreaterThan(baseInputs.baselineScore);
  });

  it('high pass-rate telemetry contributes nothing', () => {
    const e = new RiskScoreEngine();
    const tele: TelemetryPayload[] = [
      {
        id: 'p1', tenantId: 't1', streamId: 's', occurredAt: TIME,
        metric: { type: 'safety_eval', suiteId: 'su', passRate: 1.0, sampleSize: 100 },
      },
      {
        id: 'p2', tenantId: 't1', streamId: 's', occurredAt: TIME,
        metric: { type: 'probe_rollup', probeId: 'p', windowSeconds: 60, runs: 1, passes: 1, failures: 0, passRate: 1.0 },
      },
    ];
    const r = e.rescore({ ...baseInputs, telemetry: tele });
    expect(r.score).toBe(baseInputs.baselineScore);
  });
});

describe('RiskScoreEngine — golden fixture', () => {
  it('matches expected output for canonical input', () => {
    const e = new RiskScoreEngine();
    const alerts: SurveillanceAlert[] = [
      { alertId: 'a1', tenantId: 't1', streamId: 's', thresholdId: 'th', severity: 'warning', metricType: 'latency', observedValue: 1, boundary: 0, op: 'gt', raisedAt: TIME, context: {} },
      { alertId: 'a2', tenantId: 't1', streamId: 's', thresholdId: 'th', severity: 'critical', metricType: 'incident_rate', observedValue: 1, boundary: 0, op: 'gt', raisedAt: TIME, context: {} },
    ];
    const incidents: IncidentRecord[] = [
      {
        incidentId: 'i1', tenantId: 't1', engagementId: 'eng1',
        kind: 'security', severity: 'medium', title: 't', summary: 's',
        occurredAt: TIME, reportedAt: TIME, affectedSystemIds: [], resolved: false,
      },
    ];
    const r = e.rescore({ ...baseInputs, alerts, incidents });
    // baseline 30 + warning(4) + critical(12) + medium(5) = 51
    expect(r.score).toBe(51);
    expect(r.level).toBe('elevated');
    expect(r.contributors).toHaveLength(3);
  });
});
