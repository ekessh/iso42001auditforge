// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';

import type { AuditTeam } from '../types/team.js';

/**
 * Per ISO/IEC 17021-1:2015 clause 9.2.1.1, every audit team has exactly
 * one designated lead auditor.
 */
export function assertTeamHasLeadAuditor(team: AuditTeam): void {
  const leads = team.assignments.filter((a) => a.role === 'lead_auditor');
  if (leads.length === 0) {
    throw new ValidationError('Audit team must have a lead auditor', {
      engagementId: team.engagementId,
    });
  }
  if (leads.length > 1) {
    throw new ValidationError('Audit team must have exactly one lead auditor', {
      engagementId: team.engagementId,
      count: leads.length,
    });
  }
}

/** Reject duplicate (auditor, role) pairs. */
export function assertNoDuplicateAssignments(team: AuditTeam): void {
  const seen = new Set<string>();
  for (const a of team.assignments) {
    const key = `${a.auditorId}::${a.role}`;
    if (seen.has(key)) {
      throw new ValidationError(`Duplicate role assignment: ${key}`, {
        engagementId: team.engagementId,
      });
    }
    seen.add(key);
  }
}
