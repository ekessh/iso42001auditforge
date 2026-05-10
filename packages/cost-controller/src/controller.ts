// SPDX-License-Identifier: BUSL-1.1
import { CostBudgetExceeded } from './types.js';
import type { BudgetSnapshot, CostDecision } from './types.js';
import type { CostStore } from './store.js';
import type { CostEventSink, CostEventName } from './events.js';

export interface CostControllerOpts {
  warnAt?: number;
  events?: CostEventSink;
  now?: () => Date;
}

export class CostController {
  private readonly store: CostStore;
  private readonly warnAt: number;
  private readonly events: CostEventSink | null;
  private readonly now: () => Date;
  private readonly emittedWarning = new Set<string>();
  private readonly emittedExceeded = new Set<string>();

  constructor(store: CostStore, opts: CostControllerOpts = {}) {
    this.store = store;
    this.warnAt = opts.warnAt ?? 0.8;
    this.events = opts.events ?? null;
    this.now = opts.now ?? (() => new Date());
  }

  async snapshot(engagementId: string): Promise<BudgetSnapshot> {
    const budget = await this.store.getBudget(engagementId);
    const spent = await this.store.getSpent(engagementId);
    return this.makeSnapshot(engagementId, budget?.capUsd ?? null, spent, 0);
  }

  async preflight(
    engagementId: string,
    estimatedUsd: number,
    isCloud: boolean,
    overrideTokenAccepted = false,
  ): Promise<CostDecision> {
    const budget = await this.store.getBudget(engagementId);
    const spent = await this.store.getSpent(engagementId);
    const cap = budget?.capUsd ?? null;
    const snap = this.makeSnapshot(engagementId, cap, spent, estimatedUsd);

    if (cap === null) {
      return { mode: 'allow', warned: false, spentBefore: spent, capUsd: null, snapshot: snap };
    }

    if (snap.exceeded) {
      await this.fireOnce(engagementId, 'llm.budget.exceeded', snap);
    } else if (snap.warned) {
      await this.fireOnce(engagementId, 'llm.budget.warning', snap);
    }

    if (isCloud && snap.exceeded) {
      if (overrideTokenAccepted) {
        return { mode: 'allow', warned: true, spentBefore: spent, capUsd: cap, snapshot: snap };
      }
      return {
        mode: 'fallback_local',
        warned: true,
        spentBefore: spent,
        capUsd: cap,
        snapshot: snap,
      };
    }
    if (!isCloud && snap.exceeded) {
      if (overrideTokenAccepted) {
        return { mode: 'allow', warned: true, spentBefore: spent, capUsd: cap, snapshot: snap };
      }
      throw new CostBudgetExceeded(engagementId, cap, estimatedUsd);
    }
    return {
      mode: 'allow',
      warned: snap.warned,
      spentBefore: spent,
      capUsd: cap,
      snapshot: snap,
    };
  }

  async record(engagementId: string, deltaUsd: number): Promise<number> {
    if (deltaUsd <= 0) return this.store.getSpent(engagementId);
    return this.store.addSpend(engagementId, deltaUsd);
  }

  // WHY: explicit reset is exposed for the per-engagement budget reset flow
  // (e.g., admin raises the cap). Without this the warning latch would never
  // re-fire across the new headroom.
  resetEmissionLatch(engagementId: string): void {
    this.emittedWarning.delete(engagementId);
    this.emittedExceeded.delete(engagementId);
  }

  private makeSnapshot(
    engagementId: string,
    cap: number | null,
    spent: number,
    estimated: number,
  ): BudgetSnapshot {
    const projected = spent + estimated;
    if (cap === null) {
      return {
        engagementId,
        capUsd: null,
        spentUsd: spent,
        projectedUsd: projected,
        utilization: 0,
        warned: false,
        exceeded: false,
      };
    }
    const utilization = cap > 0 ? projected / cap : 1;
    return {
      engagementId,
      capUsd: cap,
      spentUsd: spent,
      projectedUsd: projected,
      utilization,
      warned: utilization >= this.warnAt,
      exceeded: projected >= cap,
    };
  }

  private async fireOnce(
    engagementId: string,
    name: CostEventName,
    snapshot: BudgetSnapshot,
  ): Promise<void> {
    if (!this.events) return;
    const latch = name === 'llm.budget.exceeded' ? this.emittedExceeded : this.emittedWarning;
    if (latch.has(engagementId)) return;
    latch.add(engagementId);
    await this.events.emit({
      name,
      engagementId,
      snapshot,
      at: this.now().toISOString(),
    });
  }
}
