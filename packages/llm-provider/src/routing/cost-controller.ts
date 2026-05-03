// SPDX-License-Identifier: BUSL-1.1
import { CostBudgetExceeded } from '../errors.js';

export interface CostBudget {
  engagementId: string;
  capUsd: number;
}

export interface CostUsage {
  engagementId: string;
  spentUsd: number;
}

export interface CostStore {
  getBudget(engagementId: string): Promise<CostBudget | null>;
  getSpent(engagementId: string): Promise<number>;
  addSpend(engagementId: string, deltaUsd: number): Promise<number>;
}

export class InMemoryCostStore implements CostStore {
  private readonly budgets = new Map<string, CostBudget>();
  private readonly spent = new Map<string, number>();

  putBudget(b: CostBudget): void {
    this.budgets.set(b.engagementId, { ...b });
  }

  async getBudget(engagementId: string): Promise<CostBudget | null> {
    const b = this.budgets.get(engagementId);
    return b ? { ...b } : null;
  }

  async getSpent(engagementId: string): Promise<number> {
    return this.spent.get(engagementId) ?? 0;
  }

  async addSpend(engagementId: string, deltaUsd: number): Promise<number> {
    const current = this.spent.get(engagementId) ?? 0;
    const next = current + deltaUsd;
    this.spent.set(engagementId, next);
    return next;
  }
}

export type CostDecision =
  | { mode: 'allow'; warned: boolean; spentBefore: number; capUsd: number | null }
  | { mode: 'fallback_local'; warned: true; spentBefore: number; capUsd: number };

export class CostController {
  constructor(
    private readonly store: CostStore,
    private readonly warnAt = 0.8,
  ) {}

  async preflight(
    engagementId: string,
    estimatedUsd: number,
    isCloud: boolean,
  ): Promise<CostDecision> {
    const budget = await this.store.getBudget(engagementId);
    const spent = await this.store.getSpent(engagementId);
    if (!budget) {
      return { mode: 'allow', warned: false, spentBefore: spent, capUsd: null };
    }
    const projected = spent + estimatedUsd;
    if (isCloud && projected >= budget.capUsd) {
      return {
        mode: 'fallback_local',
        warned: true,
        spentBefore: spent,
        capUsd: budget.capUsd,
      };
    }
    if (!isCloud && projected > budget.capUsd) {
      throw new CostBudgetExceeded(engagementId, budget.capUsd, estimatedUsd);
    }
    const warned = projected >= budget.capUsd * this.warnAt;
    return { mode: 'allow', warned, spentBefore: spent, capUsd: budget.capUsd };
  }

  async record(engagementId: string, deltaUsd: number): Promise<number> {
    if (deltaUsd <= 0) {
      return this.store.getSpent(engagementId);
    }
    return this.store.addSpend(engagementId, deltaUsd);
  }
}
