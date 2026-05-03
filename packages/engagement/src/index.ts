// SPDX-License-Identifier: BUSL-1.1
/**
 * @auditforge/engagement — public surface.
 *
 * Phase 3 of the AuditForge ISO/IEC 42001 build (see `auditforge.md`
 * Section 3.2). Implements engagements, audit events, programme
 * calculator, plan builder, audit team + impartiality, and the per-stage
 * workflow state machines.
 *
 * Outbound dependencies:
 *  - @auditforge/shared       — branded ID types, errors, Result
 *  - @auditforge/audit-engine (TODO; via `LedgerPort` outbound port)
 *  - @auditforge/tenancy-core (TODO; via `TenantContext`)
 *  - @auditforge/db           (TODO; consumed by service layer in apps/)
 *  - @auditforge/report-engine (TODO; via `PlanExportAdapter` outbound port)
 */

// Domain types — single source of truth.
export * from './types/index.js';

// Aggregates / services / value-object helpers.
export { EngagementService } from './engagement/service.js';

// Programme calculator.
export {
  calculateProgramme,
  IAF_MD_11_INTEGRATION_CAP_PCT,
  IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT,
  baseManDaysFromPersonnel,
  defaultEffectivePersonnelCount,
} from './programme/calculator.js';

// Plan tooling.
export { buildPlan } from './plan/builder.js';
export {
  detectPlanConflicts,
  applyPlanMove,
  type ApplyMoveResult,
  type ConflictDetectorOptions,
} from './plan/conflicts.js';
export { PlanReceiptStateMachine } from './plan/receipt.js';
export { NoopPlanExportAdapter } from './plan/export.js';

// Team + impartiality.
export {
  evaluateImpartiality,
  DEFAULT_IMPARTIALITY_LOOKBACK_YEARS,
} from './team/impartiality.js';
export {
  assertTeamHasLeadAuditor,
  assertNoDuplicateAssignments,
} from './team/validation.js';

// Workflow state machines.
export { Stage1Workflow } from './workflows/stage1.js';
export { Stage2Workflow } from './workflows/stage2.js';
export { SurveillanceWorkflow } from './workflows/surveillance.js';
export { RecertificationWorkflow } from './workflows/recertification.js';
export { SpecialAuditWorkflow } from './workflows/special.js';
export { StateMachine } from './workflows/machine.js';

// Outbound ports.
export {
  type LedgerPort,
  type LedgerEvent,
  type TenantContext,
  InMemoryLedger,
} from './ports.js';
