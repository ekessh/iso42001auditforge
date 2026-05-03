// SPDX-License-Identifier: BUSL-1.1
import {
  type IncidentRecord,
  type OpenNonconformity,
  type RiskRescore,
  type SurveillanceAlert,
  type SurveillanceScopeProposal,
} from './domain.js';

/**
 * SurveillanceScopeAdjuster — proposes the next surveillance scope from
 * alerts, incidents, carry-forward NCs, and the current risk score. Output is
 * deterministic and stable for the same input set (regardless of input order)
 * to make golden-file tests easy.
 */

export interface ScopeAdjustInputs {
  proposalId: string;
  tenantId: string;
  engagementId: string;
  generatedAt: string;
  rescore: RiskRescore;
  openNcs: ReadonlyArray<OpenNonconformity>;
  alerts: ReadonlyArray<SurveillanceAlert>;
  recentIncidents: ReadonlyArray<IncidentRecord>;
  /** Maps metricType -> control ref for alert-driven scope items. */
  alertRefMap?: Readonly<Record<string, string>>;
  /** Maps incident kind -> control ref. */
  incidentRefMap?: Readonly<Record<string, string>>;
}

const DEFAULT_ALERT_REF: Record<string, string> = {
  probe_rollup: 'A.6.2',
  drift_indicator: 'A.7.4',
  incident_rate: 'A.5.5',
  latency: 'A.8.3',
  cost: 'A.8.4',
  model_update: 'A.6.2',
  safety_eval: 'A.6.2',
  availability: 'A.8.3',
};

const DEFAULT_INCIDENT_REF: Record<string, string> = {
  safety: 'A.5.5',
  security: 'A.5.5',
  privacy: 'A.7.5',
  bias: 'A.6.2',
  misuse: 'A.5.5',
  availability: 'A.8.3',
  performance: 'A.8.3',
  other: 'A.5.5',
};

const NC_SEVERITY_WEIGHT: Record<OpenNonconformity['severity'], number> = {
  minor: 1,
  major: 3,
  critical: 6,
};

const ALERT_SEVERITY_WEIGHT: Record<SurveillanceAlert['severity'], number> = {
  info: 0,
  warning: 2,
  critical: 5,
};

const INCIDENT_SEVERITY_WEIGHT: Record<IncidentRecord['severity'], number> = {
  low: 1,
  medium: 3,
  high: 5,
  critical: 7,
};

interface Item {
  ref: string;
  reason: SurveillanceScopeProposal['scopeItems'][number]['reason'];
  weight: number;
}

function bumpItem(map: Map<string, Item>, key: string, item: Item): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...item });
    return;
  }
  // Prefer the more severe reason where applicable; sum weights.
  const order: Record<Item['reason'], number> = {
    open_nc: 4,
    alert_critical: 5,
    alert_warning: 2,
    incident_recent: 3,
    risk_increase: 1,
    random_sample: 0,
  };
  if (order[item.reason] > order[existing.reason]) existing.reason = item.reason;
  existing.weight = Number((existing.weight + item.weight).toFixed(4));
}

export class SurveillanceScopeAdjuster {
  propose(input: ScopeAdjustInputs): SurveillanceScopeProposal {
    const items = new Map<string, Item>();

    const alertMap = { ...DEFAULT_ALERT_REF, ...(input.alertRefMap ?? {}) };
    const incidentMap = {
      ...DEFAULT_INCIDENT_REF,
      ...(input.incidentRefMap ?? {}),
    };

    // 1. Open NCs always carry forward.
    for (const nc of input.openNcs) {
      const weight = NC_SEVERITY_WEIGHT[nc.severity];
      bumpItem(items, `${nc.ref}|open_nc`, {
        ref: nc.ref,
        reason: 'open_nc',
        weight,
      });
    }

    // 2. Alerts contribute.
    for (const a of input.alerts) {
      const ref = alertMap[a.metricType] ?? 'A.5.5';
      const reason: Item['reason'] =
        a.severity === 'critical' ? 'alert_critical' : 'alert_warning';
      const weight = ALERT_SEVERITY_WEIGHT[a.severity];
      if (weight === 0) continue;
      bumpItem(items, `${ref}|${reason}`, { ref, reason, weight });
    }

    // 3. Recent incidents contribute.
    for (const i of input.recentIncidents) {
      const ref = incidentMap[i.kind] ?? 'A.5.5';
      const weight = INCIDENT_SEVERITY_WEIGHT[i.severity];
      bumpItem(items, `${ref}|incident_recent`, {
        ref,
        reason: 'incident_recent',
        weight,
      });
    }

    // 4. Risk-level increase contributes a baseline coverage bump.
    const riskBump = riskWeightBump(input.rescore.level);
    if (riskBump > 0) {
      bumpItem(items, `A.6.2|risk_increase`, {
        ref: 'A.6.2',
        reason: 'risk_increase',
        weight: riskBump,
      });
    }

    const sorted = [...items.values()].sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (a.ref !== b.ref) return a.ref.localeCompare(b.ref);
      return a.reason.localeCompare(b.reason);
    });

    return {
      proposalId: input.proposalId,
      tenantId: input.tenantId,
      engagementId: input.engagementId,
      scopeItems: sorted,
      proposedRiskLevel: input.rescore.level,
      generatedAt: input.generatedAt,
    };
  }
}

function riskWeightBump(level: RiskRescore['level']): number {
  switch (level) {
    case 'low':
      return 0;
    case 'moderate':
      return 1;
    case 'elevated':
      return 2;
    case 'high':
      return 4;
    case 'critical':
      return 6;
  }
}
