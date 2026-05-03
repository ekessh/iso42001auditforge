// SPDX-License-Identifier: BUSL-1.1
import { ProbeBudgetExceeded } from '@auditforge/shared';

import type { ProbeBudget } from './types.js';

/**
 * Per-engagement budget for live probes. Tracks running spend and number of
 * inference calls; throws `ProbeBudgetExceeded` when a pre-flight check would
 * push us over the cap. Auditor confirmation must happen out-of-band before
 * the budget is bumped via `approveOverThreshold`.
 */
export interface EngagementBudget {
  /** USD ceiling for live probes on this engagement. */
  costCeilingUsd: number;
  /** Hard call ceiling. */
  callCeiling: number;
  /** Spend that requires auditor confirmation (e.g. 80 % of ceiling). */
  warnThresholdUsd: number;
}

export interface BudgetSnapshot {
  readonly engagementId: string;
  readonly costCeilingUsd: number;
  readonly callCeiling: number;
  readonly warnThresholdUsd: number;
  readonly spentUsd: number;
  readonly callsMade: number;
  readonly approvedOverThreshold: boolean;
}

export interface BudgetController {
  preflight(engagementId: string, probeId: string, budget: ProbeBudget, mode: 'offline' | 'live' | 'replay'): void;
  recordSpend(engagementId: string, costUsd: number, callsMade: number): void;
  approveOverThreshold(engagementId: string): void;
  snapshot(engagementId: string): BudgetSnapshot;
  setEngagementBudget(engagementId: string, budget: EngagementBudget): void;
}

interface Internal {
  budget: EngagementBudget;
  spentUsd: number;
  callsMade: number;
  approved: boolean;
}

const DEFAULT_BUDGET: EngagementBudget = {
  costCeilingUsd: 100,
  callCeiling: 10_000,
  warnThresholdUsd: 80,
};

export class InMemoryBudgetController implements BudgetController {
  private readonly state = new Map<string, Internal>();

  setEngagementBudget(engagementId: string, budget: EngagementBudget): void {
    if (
      budget.costCeilingUsd < 0 ||
      budget.callCeiling < 0 ||
      budget.warnThresholdUsd < 0 ||
      budget.warnThresholdUsd > budget.costCeilingUsd
    ) {
      throw new Error('invalid budget: thresholds must be non-negative and warn <= ceiling');
    }
    const existing = this.state.get(engagementId);
    this.state.set(engagementId, {
      budget,
      spentUsd: existing?.spentUsd ?? 0,
      callsMade: existing?.callsMade ?? 0,
      approved: existing?.approved ?? false,
    });
  }

  /**
   * Pre-flight check called before launching a probe execution. Offline /
   * replay probes with no inference cost still pass through; the controller
   * just records zero spend.
   */
  preflight(
    engagementId: string,
    probeId: string,
    budget: ProbeBudget,
    mode: 'offline' | 'live' | 'replay',
  ): void {
    const s = this.getOrInit(engagementId);
    const projectedSpend = s.spentUsd + (mode === 'live' ? budget.costEstimateUsd : 0);
    const projectedCalls =
      s.callsMade + (mode === 'live' ? budget.estimatedCallsMax : 0);

    if (projectedCalls > s.budget.callCeiling) {
      throw new ProbeBudgetExceeded('Call ceiling would be exceeded', {
        engagementId,
        probeId,
        projectedCalls,
        callCeiling: s.budget.callCeiling,
      });
    }

    if (projectedSpend > s.budget.costCeilingUsd) {
      throw new ProbeBudgetExceeded('Cost ceiling would be exceeded', {
        engagementId,
        probeId,
        projectedSpend,
        costCeiling: s.budget.costCeilingUsd,
      });
    }

    if (projectedSpend >= s.budget.warnThresholdUsd && !s.approved) {
      throw new ProbeBudgetExceeded('Auditor confirmation required: warn threshold reached', {
        engagementId,
        probeId,
        projectedSpend,
        warnThreshold: s.budget.warnThresholdUsd,
        requiresApproval: true,
      });
    }
  }

  recordSpend(engagementId: string, costUsd: number, callsMade: number): void {
    if (costUsd < 0 || callsMade < 0) {
      throw new Error('recordSpend: negative values rejected');
    }
    const s = this.getOrInit(engagementId);
    s.spentUsd += costUsd;
    s.callsMade += callsMade;
  }

  approveOverThreshold(engagementId: string): void {
    const s = this.getOrInit(engagementId);
    s.approved = true;
  }

  snapshot(engagementId: string): BudgetSnapshot {
    const s = this.getOrInit(engagementId);
    return {
      engagementId,
      costCeilingUsd: s.budget.costCeilingUsd,
      callCeiling: s.budget.callCeiling,
      warnThresholdUsd: s.budget.warnThresholdUsd,
      spentUsd: s.spentUsd,
      callsMade: s.callsMade,
      approvedOverThreshold: s.approved,
    };
  }

  private getOrInit(engagementId: string): Internal {
    let s = this.state.get(engagementId);
    if (!s) {
      s = {
        budget: { ...DEFAULT_BUDGET },
        spentUsd: 0,
        callsMade: 0,
        approved: false,
      };
      this.state.set(engagementId, s);
    }
    return s;
  }
}
