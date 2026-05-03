// SPDX-License-Identifier: BUSL-1.1
import type { LedgerPort, TenantContext } from '../ports.js';
import type { Stage1State } from '../types/workflow.js';

import { StateMachine } from './machine.js';

const STAGE1_TRANSITIONS: Readonly<Record<Stage1State, readonly Stage1State[]>> =
  Object.freeze({
    docReview: ['scopeVerification', 'abandoned'],
    scopeVerification: ['readinessAssess', 'abandoned'],
    readinessAssess: ['stage2Decision', 'abandoned'],
    stage2Decision: ['complete', 'readinessAssess'], // can go back if more readiness work needed
    complete: [],
    abandoned: [],
  });

/**
 * Stage 1 audit workflow.
 *
 * @see ISO/IEC 17021-1:2015 clause 9.3.1 (Stage 1 audit)
 */
export class Stage1Workflow extends StateMachine<Stage1State> {
  constructor(tenant: TenantContext, ledger: LedgerPort, clock?: () => string) {
    super('stage1', 'docReview', STAGE1_TRANSITIONS, tenant, ledger, clock);
  }

  /** Static accessor for tests. */
  static transitions(): Readonly<Record<Stage1State, readonly Stage1State[]>> {
    return STAGE1_TRANSITIONS;
  }
}
