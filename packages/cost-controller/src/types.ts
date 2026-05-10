// SPDX-License-Identifier: BUSL-1.1
import { AuditForgeError } from '@auditforge/shared';

export interface CostBudget {
  engagementId: string;
  capUsd: number;
}

export interface BudgetSnapshot {
  engagementId: string;
  capUsd: number | null;
  spentUsd: number;
  projectedUsd: number;
  utilization: number;
  warned: boolean;
  exceeded: boolean;
}

export type CostDecision =
  | { mode: 'allow'; warned: boolean; spentBefore: number; capUsd: number | null; snapshot: BudgetSnapshot }
  | { mode: 'fallback_local'; warned: true; spentBefore: number; capUsd: number; snapshot: BudgetSnapshot };

// WHY: keep the public error class typed and observable; callers in apps/api
// surface the 402 response based on `code === 'COST_BUDGET_EXCEEDED'`.
export class CostBudgetExceeded extends AuditForgeError {
  constructor(engagementId: string, capUsd: number, attemptedUsd: number) {
    super(
      'COST_BUDGET_EXCEEDED',
      `engagement ${engagementId} budget cap ${capUsd} exceeded (attempted +${attemptedUsd})`,
      402,
      { engagementId, capUsd, attemptedUsd },
    );
  }
}
