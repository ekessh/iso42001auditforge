// SPDX-License-Identifier: BUSL-1.1
/**
 * Read API for candidate findings — implements the auditee-invisibility
 * invariant per v3 §15.6 hard rule:
 *
 *   "A candidate finding is never visible to the auditee. Only formal
 *    Findings, after auditor promotion and (per v2) peer review where
 *    applicable, surface in the Auditee Portal."
 *
 * Every read path goes through `listForRole`, which returns an empty list for
 * any subject acting in an auditee role. App-level guards (NestJS guards / RLS
 * policies) live elsewhere; this is the in-process invariant that test code
 * pins so the constraint can never silently regress.
 */
import type { CandidateFinding } from '../domain/candidate-finding.js';

export type SubjectRole =
  | 'auditor'
  | 'lead_auditor'
  | 'reviewer'
  | 'admin'
  | 'auditee';

export interface ListContext {
  readonly engagementId: string;
  readonly subjectRole: SubjectRole;
  readonly firmId: string;
}

export interface CandidateFindingReader {
  listByEngagement(
    engagementId: string,
    firmId: string,
  ): Promise<readonly CandidateFinding[]>;
}

export class CandidateFindingReadApi {
  constructor(private readonly reader: CandidateFindingReader) {}

  /**
   * Returns the candidate findings the subject is allowed to see. Auditee
   * subjects ALWAYS get an empty list; this is the cross-boundary invariant.
   */
  async listForRole(ctx: ListContext): Promise<readonly CandidateFinding[]> {
    if (isAuditeeRole(ctx.subjectRole)) return [];
    return this.reader.listByEngagement(ctx.engagementId, ctx.firmId);
  }
}

export function isAuditeeRole(role: SubjectRole): boolean {
  return role === 'auditee';
}
