// SPDX-License-Identifier: BUSL-1.1
import type { LedgerPort, TenantContext } from '../ports.js';
import type { SpecialAuditState } from '../types/workflow.js';
import type { SpecialAuditSubtype } from '../types/audit-event.js';

import { StateMachine } from './machine.js';

const SPECIAL_TRANSITIONS: Readonly<
  Record<SpecialAuditState, readonly SpecialAuditState[]>
> = Object.freeze({
  scoped: ['inProgress', 'abandoned'],
  inProgress: ['reportDraft', 'abandoned'],
  reportDraft: ['complete', 'inProgress'],
  complete: [],
  abandoned: [],
});

/**
 * Special audit workflow. The state machine is the same shape for all
 * subtypes, but the constructor records the subtype so ledger events
 * are differentiable.
 *
 * Subtypes (per ISO/IEC 17021-1:2015 clauses 9.6.4 + scheme rules):
 *   scope_extension — auditee adds scope; partial audit before next surveillance
 *   transfer        — re-issue certificate from another CB (IAF MD 2)
 *   short_notice    — investigate complaints, suspensions (IAF MD 5 §10.4)
 *   witnessed       — accreditation body witnesses an audit (IAF MD 17)
 *
 * @see IAF MD 2:2023 (transfer)
 * @see IAF MD 17:2019 (witnessing activities)
 */
export class SpecialAuditWorkflow extends StateMachine<SpecialAuditState> {
  readonly subtype: SpecialAuditSubtype;

  constructor(
    subtype: SpecialAuditSubtype,
    tenant: TenantContext,
    ledger: LedgerPort,
    clock?: () => string,
  ) {
    super(`special.${subtype}`, 'scoped', SPECIAL_TRANSITIONS, tenant, ledger, clock);
    this.subtype = subtype;
  }

  static transitions(): Readonly<
    Record<SpecialAuditState, readonly SpecialAuditState[]>
  > {
    return SPECIAL_TRANSITIONS;
  }
}
