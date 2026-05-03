// SPDX-License-Identifier: BUSL-1.1
import { StateMachineError } from '@auditforge/shared';

import type { LedgerPort, TenantContext } from '../ports.js';
import type { WorkflowTransition } from '../types/workflow.js';

/**
 * Generic workflow state machine helper used by every audit-type
 * workflow. The transition map is supplied by the subclass.
 *
 * Each transition emits a ledger event of the form
 * `workflow.<key>.transitioned`.
 */
export abstract class StateMachine<S extends string> {
  protected readonly history: WorkflowTransition<S>[] = [];

  protected constructor(
    protected readonly key: string,
    protected current: S,
    protected readonly transitions: Readonly<Record<S, readonly S[]>>,
    protected readonly tenant: TenantContext,
    protected readonly ledger: LedgerPort,
    protected readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** Current state. */
  state(): S {
    return this.current;
  }

  /** Whether `next` is reachable from the current state in one step. */
  canTransition(next: S): boolean {
    return this.transitions[this.current].includes(next);
  }

  /** All defined transitions for this machine — used in tests. */
  static enumerate<S extends string>(
    map: Readonly<Record<S, readonly S[]>>,
  ): { from: S; to: S }[] {
    const out: { from: S; to: S }[] = [];
    for (const fromKey of Object.keys(map) as S[]) {
      for (const to of map[fromKey]) {
        out.push({ from: fromKey, to });
      }
    }
    return out;
  }

  /** Move to `next`, emitting a ledger event. */
  async transition(next: S, actor?: string, note?: string): Promise<S> {
    if (this.current === next) return this.current;
    if (!this.canTransition(next)) {
      throw new StateMachineError(this.current, next, { workflow: this.key });
    }
    const at = this.clock();
    const rec: WorkflowTransition<S> = {
      from: this.current,
      to: next,
      at,
      ...(actor !== undefined ? { actor } : {}),
      ...(note !== undefined ? { note } : {}),
    };
    this.history.push(rec);
    await this.ledger.emit({
      tenant: this.tenant,
      type: `workflow.${this.key}.transitioned`,
      payload: rec as unknown as Record<string, unknown>,
    });
    this.current = next;
    return this.current;
  }

  log(): readonly WorkflowTransition<S>[] {
    return [...this.history];
  }
}
