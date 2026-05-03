// SPDX-License-Identifier: BUSL-1.1
/**
 * Roles that can act on a finding. Distinct from system-level RBAC roles
 * because we care about the finding-action binding here, not full auth.
 *
 * - `lead_auditor` — can do everything an `auditor` can, plus override
 *   disputes and carry forward NCs
 * - `auditor`      — can issue/accept/resolve/close findings
 * - `auditee`      — can only dispute (in scope of their engagement)
 * - `reviewer`     — peer-review role; can resolve but not close
 */
export type FindingRole =
  | 'lead_auditor'
  | 'auditor'
  | 'auditee'
  | 'reviewer';

export const ALL_FINDING_ROLES: readonly FindingRole[] = [
  'lead_auditor',
  'auditor',
  'auditee',
  'reviewer',
];
