// SPDX-License-Identifier: BUSL-1.1
import type { BudgetSnapshot } from './types.js';

export type CostEventName = 'llm.budget.warning' | 'llm.budget.exceeded';

export interface CostEvent {
  name: CostEventName;
  engagementId: string;
  snapshot: BudgetSnapshot;
  at: string;
}

export interface CostEventSink {
  emit(event: CostEvent): void | Promise<void>;
}

// WHY: tests assert ordering and dedup; the in-memory sink is also used by
// apps/api/audit-ledger as the default sink in dev. Once a warning fires for
// an engagement we don't re-emit until usage drops back below the threshold,
// matching the cost-ledger event semantics in CLAUDE.md.
export class InMemoryCostEventSink implements CostEventSink {
  readonly events: CostEvent[] = [];
  emit(event: CostEvent): void {
    this.events.push({ ...event, snapshot: { ...event.snapshot } });
  }
  clear(): void {
    this.events.length = 0;
  }
}
