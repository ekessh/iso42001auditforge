// SPDX-License-Identifier: BUSL-1.1
import { StateMachineError } from '@auditforge/shared';

import type {
  PlanReceipt,
  PlanReceiptComment,
  PlanReceiptStatus,
} from '../types/plan.js';

const TRANSITIONS: Readonly<
  Record<PlanReceiptStatus, readonly PlanReceiptStatus[]>
> = Object.freeze({
  sent: ['received'],
  received: ['commented', 'acknowledged'],
  commented: ['acknowledged', 'received'],
  acknowledged: [],
});

/**
 * Plan-receipt state machine: drives the auditee acceptance handshake
 * required by ISO/IEC 17021-1:2015 clause 9.4.2.
 *
 * sent -> received -> [commented ↔ received]* -> acknowledged
 */
export class PlanReceiptStateMachine {
  static canTransition(
    current: PlanReceiptStatus,
    next: PlanReceiptStatus,
  ): boolean {
    return TRANSITIONS[current].includes(next);
  }

  static transition(
    receipt: PlanReceipt,
    next: PlanReceiptStatus,
    at: string,
  ): PlanReceipt {
    if (!PlanReceiptStateMachine.canTransition(receipt.status, next)) {
      throw new StateMachineError(receipt.status, next);
    }
    type MutablePartial = { -readonly [K in keyof PlanReceipt]?: PlanReceipt[K] };
    const stamp: MutablePartial = {};
    switch (next) {
      case 'received':
        stamp.receivedAt = at;
        break;
      case 'commented':
        stamp.commentedAt = at;
        break;
      case 'acknowledged':
        stamp.acknowledgedAt = at;
        break;
      case 'sent':
        break;
    }
    return { ...receipt, ...stamp, status: next };
  }

  /** Append a comment; transitions to `commented` if currently `received`. */
  static addComment(
    receipt: PlanReceipt,
    comment: PlanReceiptComment,
  ): PlanReceipt {
    if (receipt.status === 'acknowledged') {
      throw new StateMachineError('acknowledged', 'commented', {
        reason: 'cannot comment on an acknowledged plan',
      });
    }
    const next: PlanReceipt =
      receipt.status === 'sent'
        ? PlanReceiptStateMachine.transition(receipt, 'received', comment.createdAt)
        : receipt;
    const moved =
      next.status === 'received'
        ? PlanReceiptStateMachine.transition(next, 'commented', comment.createdAt)
        : next;
    return {
      ...moved,
      comments: Object.freeze([...moved.comments, comment]),
    };
  }
}
