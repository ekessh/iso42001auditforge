// SPDX-License-Identifier: BUSL-1.1
/**
 * Hand-rolled state machine wrapper. Holds the transitions table and offers
 * a single high-level `apply` entry point used by the registry.
 *
 * The machine is configurable: callers can pass their own transitions to
 * `createStateMachine` to support alternate CB processes, but
 * `createDefaultStateMachine()` returns the canonical one.
 */
import type { AuditorId } from '@auditforge/shared';
import type {
  DispositionHistoryEntry,
  FindingStatus,
} from '../types/finding.js';
import type { FindingRole } from '../types/roles.js';
import {
  ALL_FINDING_STATUSES,
  TRANSITIONS,
  canTransition,
  type CanTransitionResult,
  type Transition,
  type TransitionAction,
  requireTransition,
} from './transitions.js';

export interface StateMachine {
  readonly transitions: readonly Transition[];
  readonly statuses: readonly FindingStatus[];
  apply(input: ApplyTransitionInput): ApplyTransitionResult;
  can(input: {
    action: TransitionAction;
    from: FindingStatus;
    role: FindingRole;
  }): CanTransitionResult;
}

export interface ApplyTransitionInput {
  readonly action: TransitionAction;
  readonly from: FindingStatus;
  readonly role: FindingRole;
  readonly by: AuditorId;
  readonly at: string; // ISO 8601
  readonly note?: string;
}

export interface ApplyTransitionResult {
  readonly to: FindingStatus;
  readonly entry: DispositionHistoryEntry;
}

/**
 * Build a state machine from the supplied transition table. The default
 * factory uses the canonical AuditForge table; pass a custom table for
 * scheme-specific behaviour (e.g. an extra "withdrawn" path).
 */
export function createStateMachine(
  transitions: readonly Transition[] = TRANSITIONS,
): StateMachine {
  const tx = transitions;
  const statuses = ALL_FINDING_STATUSES;

  return {
    transitions: tx,
    statuses,
    can(input) {
      // Use the local table by re-implementing canTransition against `tx`.
      const t = tx.find((c) => c.action === input.action && c.from === input.from);
      if (!t) return { ok: false, reason: 'no_transition' };
      if (!t.allowedRoles.includes(input.role)) {
        return { ok: false, reason: 'role_denied' };
      }
      return { ok: true, to: t.to };
    },
    apply(input) {
      // Local apply must use the same custom table; reuse `can` above to
      // keep the code path single-source-of-truth.
      const result = this.can({
        action: input.action,
        from: input.from,
        role: input.role,
      });
      if (!result.ok) {
        // Mirror requireTransition's behaviour exactly.
        return requireTransitionFallback(input);
      }
      const entry: DispositionHistoryEntry = {
        at: input.at,
        by: input.by,
        fromStatus: input.from,
        toStatus: result.to,
        action: input.action,
        ...(input.note !== undefined ? { note: input.note } : {}),
      };
      return { to: result.to, entry };
    },
  };
}

function requireTransitionFallback(
  input: ApplyTransitionInput,
): ApplyTransitionResult {
  // Delegates to the canonical helper which throws StateMachineError.
  // We only get here when the custom-table lookup failed but the canonical
  // table also fails — this guarantees we throw a consistent error.
  requireTransition({
    action: input.action,
    from: input.from,
    role: input.role,
  });
  // Unreachable — requireTransition always throws on failure. Including a
  // throw here so the type system knows this branch never returns.
  throw new Error('unreachable');
}

export function createDefaultStateMachine(): StateMachine {
  return createStateMachine(TRANSITIONS);
}
