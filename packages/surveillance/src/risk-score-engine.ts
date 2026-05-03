// SPDX-License-Identifier: BUSL-1.1
import {
  type IncidentRecord,
  type RiskLevel,
  type RiskRescore,
  type SurveillanceAlert,
  type TelemetryPayload,
} from './domain.js';

/**
 * RiskScoreEngine — deterministic re-scoring of engagement risk.
 *
 * Inputs:
 *   - baselineScore: prior risk score (0..100)
 *   - alerts:       open SurveillanceAlerts since last rescore
 *   - incidents:    A.5.5 incidents since last rescore
 *   - telemetry:    optional aggregate telemetry (drift, pass-rate, etc.)
 *
 * The function is **pure**: same inputs -> same outputs. Contributors are
 * sorted in a deterministic order so test fixtures can pin exact output.
 */

export interface RiskInputs {
  rescoreId: string;
  tenantId: string;
  engagementId: string;
  baselineScore: number;
  alerts: ReadonlyArray<SurveillanceAlert>;
  incidents: ReadonlyArray<IncidentRecord>;
  telemetry?: ReadonlyArray<TelemetryPayload>;
  computedAt: string;
}

const ALERT_WEIGHT: Record<SurveillanceAlert['severity'], number> = {
  info: 0,
  warning: 4,
  critical: 12,
};

const INCIDENT_WEIGHT: Record<IncidentRecord['severity'], number> = {
  low: 2,
  medium: 5,
  high: 10,
  critical: 18,
};

const RESOLVED_DAMPENING = 0.3;

const LEVEL_BANDS: ReadonlyArray<{ max: number; level: RiskLevel }> = [
  { max: 20, level: 'low' },
  { max: 40, level: 'moderate' },
  { max: 60, level: 'elevated' },
  { max: 80, level: 'high' },
  { max: 100, level: 'critical' },
];

function levelFromScore(score: number): RiskLevel {
  for (const band of LEVEL_BANDS) {
    if (score <= band.max) return band.level;
  }
  return 'critical';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface Contributor {
  source: string;
  weight: number;
  delta: number;
}

function alertContributors(alerts: ReadonlyArray<SurveillanceAlert>): Contributor[] {
  // Group alerts by (severity, metricType) for deterministic ordering.
  const map = new Map<string, { severity: SurveillanceAlert['severity']; metricType: string; count: number }>();
  for (const a of alerts) {
    const k = `${a.severity}:${a.metricType}`;
    const v = map.get(k);
    if (v) v.count += 1;
    else map.set(k, { severity: a.severity, metricType: a.metricType, count: 1 });
  }
  const list: Contributor[] = [];
  for (const [, v] of map) {
    const w = ALERT_WEIGHT[v.severity];
    if (w === 0) continue;
    list.push({
      source: `alert:${v.metricType}:${v.severity}`,
      weight: w,
      delta: w * v.count,
    });
  }
  list.sort((a, b) => a.source.localeCompare(b.source));
  return list;
}

function incidentContributors(
  incidents: ReadonlyArray<IncidentRecord>,
): Contributor[] {
  const map = new Map<
    string,
    { severity: IncidentRecord['severity']; kind: string; resolved: number; open: number }
  >();
  for (const i of incidents) {
    const k = `${i.severity}:${i.kind}`;
    const v = map.get(k);
    if (v) {
      if (i.resolved) v.resolved += 1;
      else v.open += 1;
    } else {
      map.set(k, {
        severity: i.severity,
        kind: i.kind,
        resolved: i.resolved ? 1 : 0,
        open: i.resolved ? 0 : 1,
      });
    }
  }
  const list: Contributor[] = [];
  for (const [, v] of map) {
    const w = INCIDENT_WEIGHT[v.severity];
    const effective = v.open + v.resolved * RESOLVED_DAMPENING;
    if (effective <= 0) continue;
    list.push({
      source: `incident:${v.kind}:${v.severity}`,
      weight: w,
      delta: Number((w * effective).toFixed(4)),
    });
  }
  list.sort((a, b) => a.source.localeCompare(b.source));
  return list;
}

function telemetryContributors(
  telemetry: ReadonlyArray<TelemetryPayload>,
): Contributor[] {
  const list: Contributor[] = [];
  let driftSum = 0;
  let driftCount = 0;
  let safetyFailWeight = 0;
  let probeFailWeight = 0;
  for (const p of telemetry) {
    const m = p.metric;
    if (m.type === 'drift_indicator') {
      driftSum += m.score;
      driftCount += 1;
    } else if (m.type === 'safety_eval') {
      // Each 0.01 below pass adds weight.
      const shortfall = Math.max(0, 0.95 - m.passRate);
      safetyFailWeight += shortfall * 100;
    } else if (m.type === 'probe_rollup') {
      const shortfall = Math.max(0, 0.9 - m.passRate);
      probeFailWeight += shortfall * 50;
    }
  }
  if (driftCount > 0) {
    const meanDrift = driftSum / driftCount;
    if (meanDrift > 0.1) {
      list.push({
        source: 'telemetry:drift_mean',
        weight: 8,
        delta: Number((meanDrift * 8).toFixed(4)),
      });
    }
  }
  if (safetyFailWeight > 0) {
    list.push({
      source: 'telemetry:safety_eval',
      weight: 1,
      delta: Number(safetyFailWeight.toFixed(4)),
    });
  }
  if (probeFailWeight > 0) {
    list.push({
      source: 'telemetry:probe_rollup',
      weight: 1,
      delta: Number(probeFailWeight.toFixed(4)),
    });
  }
  list.sort((a, b) => a.source.localeCompare(b.source));
  return list;
}

export class RiskScoreEngine {
  /** Pure deterministic risk recompute. */
  rescore(input: RiskInputs): RiskRescore {
    const contributors: Contributor[] = [];
    contributors.push(...alertContributors(input.alerts));
    contributors.push(...incidentContributors(input.incidents));
    contributors.push(...telemetryContributors(input.telemetry ?? []));

    const totalDelta = contributors.reduce((acc, c) => acc + c.delta, 0);
    const score = clamp(
      Number((input.baselineScore + totalDelta).toFixed(4)),
      0,
      100,
    );
    const level = levelFromScore(score);

    return {
      rescoreId: input.rescoreId,
      tenantId: input.tenantId,
      engagementId: input.engagementId,
      score,
      level,
      contributors,
      computedAt: input.computedAt,
    };
  }
}
