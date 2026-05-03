// SPDX-License-Identifier: BUSL-1.1
import type { LedgerPort, TenantContext } from '../ports.js';
import type { RecertificationState } from '../types/workflow.js';

import { StateMachine } from './machine.js';

const RECERT_TRANSITIONS: Readonly<
  Record<RecertificationState, readonly RecertificationState[]>
> = Object.freeze({
  performanceTrendReview: ['fullReAudit', 'abandoned'],
  fullReAudit: ['reportDraft', 'abandoned'],
  reportDraft: ['decision', 'fullReAudit'],
  decision: ['complete', 'reportDraft'],
  complete: [],
  abandoned: [],
});

/**
 * Recertification workflow — full re-audit + performance trend review.
 *
 * @see ISO/IEC 17021-1:2015 clause 9.6.3 (recertification activities)
 */
export class RecertificationWorkflow extends StateMachine<RecertificationState> {
  constructor(tenant: TenantContext, ledger: LedgerPort, clock?: () => string) {
    super(
      'recertification',
      'performanceTrendReview',
      RECERT_TRANSITIONS,
      tenant,
      ledger,
      clock,
    );
  }

  static transitions(): Readonly<
    Record<RecertificationState, readonly RecertificationState[]>
  > {
    return RECERT_TRANSITIONS;
  }
}
