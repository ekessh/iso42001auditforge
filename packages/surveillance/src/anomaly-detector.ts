// SPDX-License-Identifier: BUSL-1.1
/**
 * Surveillance anomaly detector.
 *
 * WHY rule-based first: hand-tuned rules grounded in ISO 17021-1 § 9.6 are auditable. ML scoring
 * sits alongside but can never be the sole trigger for a `surveillance.flag` because the auditor
 * must reproduce the reasoning in the audit record.
 *
 * Rules are pure functions of `SurveillancePlan` + recent telemetry; they emit a list of
 * `SurveillanceFlag`s with severity, rationale, and the rule id that fired. Callers route flags
 * to the audit ledger (`surveillance.flag` event) and the alert dispatcher.
 */
import { z } from 'zod';

import type { SurveillancePlan } from './surveillance-plan.js';
import { daysSinceLastSurveillance, lastClosedVisit, nextPlannedVisit } from './surveillance-plan.js';

const idSchema = z.string().min(1).max(128);

export const FLAG_SEVERITY = ['info', 'warning', 'critical'] as const;
export type FlagSeverity = (typeof FLAG_SEVERITY)[number];

export const FLAG_RULE_IDS = [
  'scope_expansion_without_recent_survey',
  'overdue_planned_visit',
  'unresolved_critical_complaint',
  'high_severity_open_nc',
  'reaudit_trigger_change',
  'silent_telemetry_stream',
  'rapid_repeat_critical_alerts',
] as const;

export type FlagRuleId = (typeof FLAG_RULE_IDS)[number];

export const surveillanceFlagSchema = z
  .object({
    flagId: idSchema,
    ruleId: z.enum(FLAG_RULE_IDS),
    severity: z.enum(FLAG_SEVERITY),
    clientId: idSchema,
    tenantId: idSchema,
    rationale: z.string().min(1).max(2048),
    evidence: z.record(z.string(), z.unknown()).default({}),
    raisedAt: z.string().min(20).max(40),
    suggestedAction: z.enum(['schedule_special_audit', 'expand_scope', 'monitor', 'verify_capa']),
  })
  .strict();

export type SurveillanceFlag = z.infer<typeof surveillanceFlagSchema>;

export interface AnomalyContext {
  readonly recentScopeChangePct?: number;
  readonly silentStreamSince?: string;
  readonly recentCriticalAlertCount?: number;
  readonly recentCriticalAlertWindowDays?: number;
}

export interface AnomalyConfig {
  readonly scopeExpansionPctThreshold?: number;
  readonly daysSinceSurveyForExpansionFlag?: number;
  readonly overdueGraceDays?: number;
  readonly silentStreamMaxHours?: number;
  readonly criticalAlertBurstThreshold?: number;
  readonly criticalAlertBurstWindowDays?: number;
}

const DEFAULT_CONFIG: Required<AnomalyConfig> = {
  scopeExpansionPctThreshold: 20,
  daysSinceSurveyForExpansionFlag: 90,
  overdueGraceDays: 14,
  silentStreamMaxHours: 72,
  criticalAlertBurstThreshold: 3,
  criticalAlertBurstWindowDays: 7,
};

export interface DetectAnomaliesInput {
  readonly plan: SurveillancePlan;
  readonly ctx: AnomalyContext;
  readonly now: Date;
  readonly newFlagId: () => string;
  readonly config?: AnomalyConfig;
}

export function detectAnomalies(input: DetectAnomaliesInput): SurveillanceFlag[] {
  const cfg = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };
  const out: SurveillanceFlag[] = [];
  const raisedAt = input.now.toISOString();

  const expansionPct = input.ctx.recentScopeChangePct ?? 0;
  const sinceLast = daysSinceLastSurveillance(input.plan, input.now);
  if (
    expansionPct >= cfg.scopeExpansionPctThreshold &&
    (sinceLast === null || sinceLast >= cfg.daysSinceSurveyForExpansionFlag)
  ) {
    out.push({
      flagId: input.newFlagId(),
      ruleId: 'scope_expansion_without_recent_survey',
      severity: 'critical',
      clientId: input.plan.clientId,
      tenantId: input.plan.tenantId,
      rationale: `AIMS scope expanded ${expansionPct.toFixed(1)}% with last surveillance ${
        sinceLast === null ? 'never recorded' : `${sinceLast} days ago`
      }; ISO 17021-1 § 9.6 special audit indication.`,
      evidence: {
        expansionPct,
        daysSinceLastSurveillance: sinceLast,
        threshold: cfg.scopeExpansionPctThreshold,
      },
      raisedAt,
      suggestedAction: 'schedule_special_audit',
    });
  }

  const next = nextPlannedVisit(input.plan, input.now);
  for (const v of input.plan.visits) {
    if (v.status === 'planned') {
      const overdueDays = Math.floor(
        (input.now.getTime() - Date.parse(v.plannedAt)) / (24 * 60 * 60 * 1000),
      );
      if (overdueDays > cfg.overdueGraceDays) {
        out.push({
          flagId: input.newFlagId(),
          ruleId: 'overdue_planned_visit',
          severity: overdueDays > cfg.overdueGraceDays * 2 ? 'critical' : 'warning',
          clientId: input.plan.clientId,
          tenantId: input.plan.tenantId,
          rationale: `${v.kind} visit ${v.visitId} planned ${v.plannedAt} is overdue by ${overdueDays} days.`,
          evidence: { visitId: v.visitId, kind: v.kind, overdueDays },
          raisedAt,
          suggestedAction: 'schedule_special_audit',
        });
      }
    }
  }

  for (const c of input.plan.complaintsLog) {
    if (!c.resolved && (c.severity === 'critical' || c.severity === 'high')) {
      const ageDays = Math.floor(
        (input.now.getTime() - Date.parse(c.receivedAt)) / (24 * 60 * 60 * 1000),
      );
      out.push({
        flagId: input.newFlagId(),
        ruleId: 'unresolved_critical_complaint',
        severity: c.severity === 'critical' ? 'critical' : 'warning',
        clientId: input.plan.clientId,
        tenantId: input.plan.tenantId,
        rationale: `Unresolved ${c.severity} complaint ${c.complaintId} (age ${ageDays}d).`,
        evidence: { complaintId: c.complaintId, ageDays },
        raisedAt,
        suggestedAction: 'verify_capa',
      });
    }
  }

  for (const nc of input.plan.openNcCarryover) {
    if (nc.severity === 'critical' || nc.severity === 'major') {
      out.push({
        flagId: input.newFlagId(),
        ruleId: 'high_severity_open_nc',
        severity: nc.severity === 'critical' ? 'critical' : 'warning',
        clientId: input.plan.clientId,
        tenantId: input.plan.tenantId,
        rationale: `Open ${nc.severity} NC ${nc.ncId} (${nc.ref}) carried over.`,
        evidence: { ncId: nc.ncId, ref: nc.ref },
        raisedAt,
        suggestedAction: 'verify_capa',
      });
    }
  }

  for (const ch of input.plan.scopeChanges) {
    if (ch.triggersReaudit) {
      out.push({
        flagId: input.newFlagId(),
        ruleId: 'reaudit_trigger_change',
        severity: 'critical',
        clientId: input.plan.clientId,
        tenantId: input.plan.tenantId,
        rationale: `Scope change ${ch.changeId} (${ch.kind}) marked as re-audit trigger.`,
        evidence: { changeId: ch.changeId, kind: ch.kind },
        raisedAt,
        suggestedAction: 'schedule_special_audit',
      });
    }
  }

  if (input.ctx.silentStreamSince !== undefined) {
    const silentMs = input.now.getTime() - Date.parse(input.ctx.silentStreamSince);
    const silentH = Math.floor(silentMs / (60 * 60 * 1000));
    if (silentH >= cfg.silentStreamMaxHours) {
      out.push({
        flagId: input.newFlagId(),
        ruleId: 'silent_telemetry_stream',
        severity: 'warning',
        clientId: input.plan.clientId,
        tenantId: input.plan.tenantId,
        rationale: `Telemetry stream silent for ${silentH}h (threshold ${cfg.silentStreamMaxHours}h).`,
        evidence: { silentHours: silentH, threshold: cfg.silentStreamMaxHours },
        raisedAt,
        suggestedAction: 'monitor',
      });
    }
  }

  const burst = input.ctx.recentCriticalAlertCount ?? 0;
  const burstWindow =
    input.ctx.recentCriticalAlertWindowDays ?? cfg.criticalAlertBurstWindowDays;
  if (burst >= cfg.criticalAlertBurstThreshold) {
    out.push({
      flagId: input.newFlagId(),
      ruleId: 'rapid_repeat_critical_alerts',
      severity: 'critical',
      clientId: input.plan.clientId,
      tenantId: input.plan.tenantId,
      rationale: `${burst} critical alerts within ${burstWindow}d (threshold ${cfg.criticalAlertBurstThreshold}).`,
      evidence: { count: burst, windowDays: burstWindow },
      raisedAt,
      suggestedAction: 'schedule_special_audit',
    });
  }

  void next;
  void lastClosedVisit;
  return out;
}
