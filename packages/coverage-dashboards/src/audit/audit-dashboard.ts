// SPDX-License-Identifier: BUSL-1.1
/**
 * AuditDashboard service per v3 §15.14.
 *
 * Composes engagement state into the active-audit dashboard payloads:
 * coverage per area, man-day burndown, candidate / promoted finding counts,
 * sampling completeness, and the risk indicator.
 */
import type {
  ClauseFamily,
  ClauseState,
  SoaScope,
  WeightConfig,
} from '../domain/types.js';
import { calcReadiness } from '../readiness/calculator.js';

export interface ManDayPlan {
  readonly plannedTotal: number;
  readonly consumed: number;
}

export interface SamplingPlan {
  readonly plannedSamples: number;
  readonly executedSamples: number;
}

export interface CandidateFindingsCount {
  readonly major: number;
  readonly minor: number;
  readonly ofi: number;
  readonly observation: number;
}

export interface PromotedFindingsCount {
  readonly majorNc: number;
  readonly minorNc: number;
  readonly ofi: number;
  readonly conformity: number;
}

export interface CoveragePerArea {
  readonly family: ClauseFamily;
  /** % of in-scope clauses with status === 'evidenced' for the family. */
  readonly coveragePct: number;
  /** # of in-scope clauses for the family. */
  readonly inScopeCount: number;
  /** # of evidenced in-scope clauses. */
  readonly evidencedCount: number;
}

export type RiskIndicator = 'on_track' | 'coverage_gap' | 'time_overrun';

export interface AuditDashboardDeps {
  getClauseStates(engagementId: string): Promise<readonly ClauseState[]>;
  getSoa(engagementId: string): Promise<SoaScope>;
  getWeightConfig(engagementId: string): Promise<WeightConfig>;
  getManDayPlan(engagementId: string): Promise<ManDayPlan>;
  getSamplingPlan(engagementId: string): Promise<SamplingPlan>;
  getCandidateFindingsCount(
    engagementId: string,
  ): Promise<CandidateFindingsCount>;
  getPromotedFindingsCount(
    engagementId: string,
  ): Promise<PromotedFindingsCount>;
}

export interface RiskIndicatorThresholds {
  /** % of overall readiness below which we report "coverage_gap". Default 0.7. */
  readonly minOverall: number;
  /** Ratio (consumed/planned) above which we report "time_overrun". Default 1.0. */
  readonly maxTimeRatio: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskIndicatorThresholds = Object.freeze({
  minOverall: 0.7,
  maxTimeRatio: 1.0,
});

export class AuditDashboard {
  constructor(
    private readonly deps: AuditDashboardDeps,
    private readonly thresholds: RiskIndicatorThresholds = DEFAULT_RISK_THRESHOLDS,
  ) {}

  async coveragePerArea(
    engagementId: string,
  ): Promise<readonly CoveragePerArea[]> {
    const states = await this.deps.getClauseStates(engagementId);
    const soa = await this.deps.getSoa(engagementId);
    const inScopeIds = new Set(soa.inScopeClauseIds);
    const groups = new Map<
      ClauseFamily,
      { inScope: number; evidenced: number }
    >();
    for (const c of states) {
      if (!c.mandatory && !inScopeIds.has(c.clauseId) && !c.inScope) continue;
      let g = groups.get(c.family);
      if (!g) {
        g = { inScope: 0, evidenced: 0 };
        groups.set(c.family, g);
      }
      g.inScope += 1;
      if (c.status === 'evidenced') g.evidenced += 1;
    }
    const out: CoveragePerArea[] = [];
    for (const [family, agg] of groups) {
      out.push({
        family,
        coveragePct: agg.inScope === 0 ? 0 : agg.evidenced / agg.inScope,
        inScopeCount: agg.inScope,
        evidencedCount: agg.evidenced,
      });
    }
    return out;
  }

  async manDayBurndown(engagementId: string): Promise<{
    readonly planned: number;
    readonly consumed: number;
    readonly remaining: number;
    readonly ratio: number;
  }> {
    const plan = await this.deps.getManDayPlan(engagementId);
    const ratio = plan.plannedTotal === 0 ? 0 : plan.consumed / plan.plannedTotal;
    return {
      planned: plan.plannedTotal,
      consumed: plan.consumed,
      remaining: Math.max(0, plan.plannedTotal - plan.consumed),
      ratio,
    };
  }

  async openCandidateFindingsCount(
    engagementId: string,
  ): Promise<CandidateFindingsCount> {
    return this.deps.getCandidateFindingsCount(engagementId);
  }

  async promotedFindingsCount(
    engagementId: string,
  ): Promise<PromotedFindingsCount> {
    return this.deps.getPromotedFindingsCount(engagementId);
  }

  async samplingCompleteness(engagementId: string): Promise<{
    readonly planned: number;
    readonly executed: number;
    readonly ratio: number;
  }> {
    const plan = await this.deps.getSamplingPlan(engagementId);
    return {
      planned: plan.plannedSamples,
      executed: plan.executedSamples,
      ratio:
        plan.plannedSamples === 0
          ? 0
          : plan.executedSamples / plan.plannedSamples,
    };
  }

  async riskIndicator(engagementId: string): Promise<RiskIndicator> {
    const [states, soa, cfg, mdays] = await Promise.all([
      this.deps.getClauseStates(engagementId),
      this.deps.getSoa(engagementId),
      this.deps.getWeightConfig(engagementId),
      this.deps.getManDayPlan(engagementId),
    ]);
    const result = calcReadiness(states, soa, cfg);
    const ratio = mdays.plannedTotal === 0 ? 0 : mdays.consumed / mdays.plannedTotal;
    if (ratio > this.thresholds.maxTimeRatio) return 'time_overrun';
    if (result.overall < this.thresholds.minOverall) return 'coverage_gap';
    return 'on_track';
  }
}
