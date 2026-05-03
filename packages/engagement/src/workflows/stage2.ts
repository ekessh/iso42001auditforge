// SPDX-License-Identifier: BUSL-1.1
import type { LedgerPort, TenantContext } from '../ports.js';
import type { Stage2State } from '../types/workflow.js';

import { StateMachine } from './machine.js';

const STAGE2_TRANSITIONS: Readonly<Record<Stage2State, readonly Stage2State[]>> =
  Object.freeze({
    opening: ['areaSessions', 'abandoned'],
    areaSessions: ['interimReview', 'closing', 'abandoned'],
    interimReview: ['areaSessions', 'closing', 'abandoned'],
    closing: ['reportDraft', 'abandoned'],
    reportDraft: ['complete', 'closing'],
    complete: [],
    abandoned: [],
  });

/**
 * Stage 2 audit workflow.
 *
 * @see ISO/IEC 17021-1:2015 clause 9.3.2 (Stage 2 audit)
 */
export class Stage2Workflow extends StateMachine<Stage2State> {
  constructor(tenant: TenantContext, ledger: LedgerPort, clock?: () => string) {
    super('stage2', 'opening', STAGE2_TRANSITIONS, tenant, ledger, clock);
  }

  static transitions(): Readonly<Record<Stage2State, readonly Stage2State[]>> {
    return STAGE2_TRANSITIONS;
  }
}
