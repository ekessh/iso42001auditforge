// SPDX-License-Identifier: BUSL-1.1
/**
 * Peer-review workflow state machine.
 *
 *   pending  ── assign           ─▶  in_review
 *   in_review ── request_changes ─▶ changes_requested
 *   changes_requested ── resubmit ─▶ in_review
 *   in_review ── approve         ─▶  approved        (terminal)
 *   pending  ── withdraw         ─▶  withdrawn       (terminal)
 *   in_review ── withdraw        ─▶  withdrawn       (terminal)
 *   changes_requested ── withdraw ─▶ withdrawn       (terminal)
 *
 * Terminal states `approved` and `withdrawn` may not be exited; reopening
 * requires a brand-new `PeerReviewRequest` with a new aggregate id.
 */
import { StateMachineError } from '@auditforge/shared';
import type { PeerReviewStatus } from '../domain/enums.js';
import { TERMINAL_STATUSES } from '../domain/enums.js';

export type WorkflowAction =
  | 'assign'
  | 'request_changes'
  | 'resubmit'
  | 'approve'
  | 'withdraw';

export interface WorkflowTransition {
  readonly action: WorkflowAction;
  readonly from: PeerReviewStatus;
  readonly to: PeerReviewStatus;
}

export const TRANSITIONS: readonly WorkflowTransition[] = Object.freeze([
  { action: 'assign', from: 'pending', to: 'in_review' },
  { action: 'request_changes', from: 'in_review', to: 'changes_requested' },
  { action: 'resubmit', from: 'changes_requested', to: 'in_review' },
  { action: 'approve', from: 'in_review', to: 'approved' },
  { action: 'withdraw', from: 'pending', to: 'withdrawn' },
  { action: 'withdraw', from: 'in_review', to: 'withdrawn' },
  { action: 'withdraw', from: 'changes_requested', to: 'withdrawn' },
] as const);

/** Index keyed by `${from}::${action}` -> to. */
const INDEX: ReadonlyMap<string, PeerReviewStatus> = (() => {
  const m = new Map<string, PeerReviewStatus>();
  for (const t of TRANSITIONS) {
    m.set(`${t.from}::${t.action}`, t.to);
  }
  return m;
})();

export function listAllowedActions(from: PeerReviewStatus): readonly WorkflowAction[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.action);
}

export function isTerminal(status: PeerReviewStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canPerform(from: PeerReviewStatus, action: WorkflowAction): boolean {
  return INDEX.has(`${from}::${action}`);
}

export function nextStatus(
  from: PeerReviewStatus,
  action: WorkflowAction,
): PeerReviewStatus {
  const to = INDEX.get(`${from}::${action}`);
  if (!to) {
    throw new StateMachineError(from, action, {
      reason: 'peer-review action not permitted from current status',
    });
  }
  return to;
}
