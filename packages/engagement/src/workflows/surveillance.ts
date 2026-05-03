// SPDX-License-Identifier: BUSL-1.1
import type { LedgerPort, TenantContext } from '../ports.js';
import type { SurveillanceState } from '../types/workflow.js';

import { StateMachine } from './machine.js';

const SURV_TRANSITIONS: Readonly<
  Record<SurveillanceState, readonly SurveillanceState[]>
> = Object.freeze({
  ncFollowUp: ['reducedScopeAudit', 'abandoned'],
  reducedScopeAudit: ['schemeComplianceCheck', 'abandoned'],
  schemeComplianceCheck: ['reportDraft', 'abandoned'],
  reportDraft: ['complete', 'schemeComplianceCheck'],
  complete: [],
  abandoned: [],
});

/**
 * Surveillance audit workflow.
 *
 * @see ISO/IEC 17021-1:2015 clause 9.6.2 (surveillance activities)
 */
export class SurveillanceWorkflow extends StateMachine<SurveillanceState> {
  constructor(tenant: TenantContext, ledger: LedgerPort, clock?: () => string) {
    super('surveillance', 'ncFollowUp', SURV_TRANSITIONS, tenant, ledger, clock);
  }

  static transitions(): Readonly<
    Record<SurveillanceState, readonly SurveillanceState[]>
  > {
    return SURV_TRANSITIONS;
  }
}
