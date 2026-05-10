// SPDX-License-Identifier: BUSL-1.1
import type { CostBudget } from './types.js';

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
