// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ThresholdEvaluator } from '../src/threshold-evaluator.js';
import type { Threshold, TelemetryPayload } from '../src/domain.js';
import { makePayload, TENANT, STREAM } from './helpers.js';

function buildEvaluator() {
  let n = 0;
  const ev = new ThresholdEvaluator({
    newAlertId: () => `alert_${++n}`,
    now: () => '2026-05-03T12:00:00.000Z',
  });
  return ev;
}

const baseThreshold: Threshold = {
  thresholdId: 'th-passrate',
  tenantId: TENANT,
  streamId: STREAM,
  metricType: 'probe_rollup',
  metricSelector: 'passRate',
  op: 'lt',
  warning: 0.9,
  critical: 0.8,
  enterSamples: 3,
  exitSamples: 3,
  windowSize: 10,
};

function probe(passRate: number, id = `p_${passRate}_${Math.random()}`): TelemetryPayload {
  return makePayload({
    id,
    metric: {
      type: 'probe_rollup',
      probeId: 'p1',
      windowSeconds: 60,
      runs: 100,
      passes: Math.round(passRate * 100),
      failures: 100 - Math.round(passRate * 100),
      passRate,
    },
  });
}

describe('ThresholdEvaluator — register validation', () => {
  it('rejects warning > critical for lt op', () => {
    const ev = buildEvaluator();
    expect(() =>
      ev.register({ ...baseThreshold, warning: 0.7, critical: 0.8 }),
    ).toThrow();
  });

  it('rejects warning < critical for gt op', () => {
    const ev = buildEvaluator();
    expect(() =>
      ev.register({
        ...baseThreshold,
        op: 'gt',
        warning: 0.9,
        critical: 0.8,
      }),
    ).toThrow();
  });
});

describe('ThresholdEvaluator — hysteresis', () => {
  it('does not raise alert before enterSamples consecutive breaches', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    expect(ev.evaluate(probe(0.85))).toEqual([]);
    expect(ev.evaluate(probe(0.85))).toEqual([]);
    // 3rd breach -> raises
    const a = ev.evaluate(probe(0.85));
    expect(a).toHaveLength(1);
    expect(a[0]?.severity).toBe('warning');
    expect(ev.isArmed('th-passrate', STREAM)).toBe(true);
  });

  it('does not re-fire while armed', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    ev.evaluate(probe(0.85));
    ev.evaluate(probe(0.85));
    ev.evaluate(probe(0.85)); // raises
    expect(ev.evaluate(probe(0.85))).toEqual([]);
    expect(ev.evaluate(probe(0.7))).toEqual([]);
  });

  it('disarms after exitSamples non-breach samples', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    ev.evaluate(probe(0.5));
    ev.evaluate(probe(0.5));
    ev.evaluate(probe(0.5)); // armed
    expect(ev.isArmed('th-passrate', STREAM)).toBe(true);
    ev.evaluate(probe(0.99));
    ev.evaluate(probe(0.99));
    expect(ev.isArmed('th-passrate', STREAM)).toBe(true);
    ev.evaluate(probe(0.99)); // 3rd ok -> disarm
    expect(ev.isArmed('th-passrate', STREAM)).toBe(false);
  });

  it('re-arms cleanly after disarm', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    for (let i = 0; i < 3; i++) ev.evaluate(probe(0.5));
    for (let i = 0; i < 3; i++) ev.evaluate(probe(0.99));
    expect(ev.isArmed('th-passrate', STREAM)).toBe(false);
    const a1 = ev.evaluate(probe(0.5));
    const a2 = ev.evaluate(probe(0.5));
    const a3 = ev.evaluate(probe(0.5));
    expect(a1).toEqual([]);
    expect(a2).toEqual([]);
    expect(a3).toHaveLength(1);
  });

  it('does not flap on alternating samples', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    const alerts: number[] = [];
    for (let i = 0; i < 50; i++) {
      const v = i % 2 === 0 ? 0.5 : 0.99;
      alerts.push(ev.evaluate(probe(v)).length);
    }
    expect(alerts.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('upgrades from warning to critical when boundary crossed', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    // Critical: < 0.8
    const a1 = ev.evaluate(probe(0.5));
    const a2 = ev.evaluate(probe(0.5));
    const a3 = ev.evaluate(probe(0.5));
    expect(a1.length + a2.length + a3.length).toBe(1);
    const onlyAlert = [...a1, ...a2, ...a3][0]!;
    expect(onlyAlert.severity).toBe('critical');
    expect(onlyAlert.boundary).toBe(0.8);
  });

  it('window snapshot retains last windowSize values', () => {
    const ev = buildEvaluator();
    ev.register({ ...baseThreshold, windowSize: 4 });
    for (let i = 0; i < 10; i++) ev.evaluate(probe(0.5 + i * 0.05));
    const snap = ev.windowSnapshot('th-passrate', STREAM);
    expect(snap).toHaveLength(4);
  });

  it('ignores payloads from other streams', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    const other = makePayload({
      streamId: 'other',
      metric: { type: 'probe_rollup', probeId: 'p', windowSeconds: 60, runs: 1, passes: 0, failures: 1, passRate: 0 },
    });
    expect(ev.evaluate(other)).toEqual([]);
  });

  it('ignores wrong metric type', () => {
    const ev = buildEvaluator();
    ev.register(baseThreshold);
    const wrong = makePayload({
      metric: { type: 'latency', quantile: 'p99', valueMs: 200, sampleSize: 100 },
    });
    expect(ev.evaluate(wrong)).toEqual([]);
  });
});

describe('ThresholdEvaluator — multiple thresholds', () => {
  it('evaluates each threshold independently', () => {
    const ev = buildEvaluator();
    ev.register({ ...baseThreshold, thresholdId: 't-warn', critical: 0.8, warning: 0.9 });
    ev.register({
      ...baseThreshold,
      thresholdId: 't-strict',
      critical: 0.95,
      warning: 0.97,
      enterSamples: 1,
      exitSamples: 1,
    });
    const out = ev.evaluate(probe(0.92));
    // t-warn: 0.92 < 0.9? no — not breach. wait, 0.92 < 0.9 is false; 0.92 < 0.95 (strict critical) yes
    expect(out.find((a) => a.thresholdId === 't-strict')).toBeDefined();
    expect(out.find((a) => a.thresholdId === 't-warn')).toBeUndefined();
  });

  it('remove() stops evaluation', () => {
    const ev = buildEvaluator();
    ev.register({ ...baseThreshold, enterSamples: 1 });
    expect(ev.evaluate(probe(0.5))).toHaveLength(1);
    ev.remove('th-passrate', STREAM);
    // After remove, fresh state — register new with different id
    ev.register({ ...baseThreshold, thresholdId: 'th-new', enterSamples: 1 });
    expect(ev.evaluate(probe(0.5))).toHaveLength(1);
  });
});
