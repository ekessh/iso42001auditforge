// SPDX-License-Identifier: BUSL-1.1
import type {
  AuditorId,
  ClientId,
  EngagementId,
} from '@auditforge/shared';

/**
 * Role within an audit team. ISO/IEC 17021-1:2015 clauses 7.2 + 9.2.1 require
 * documented competence for each role; the catalogue + auditor registry
 * track that, this type is purely the role label.
 */
export type AuditRole =
  | 'lead_auditor'
  | 'auditor'
  | 'technical_expert'
  | 'observer'
  | 'auditor_in_training'
  | 'translator';

export interface RoleAssignment {
  readonly auditorId: AuditorId;
  readonly role: AuditRole;
  /**
   * Required for the role to be valid (e.g. "ISO 42001 lead auditor cert"
   * for `lead_auditor`). The competence catalogue lives in
   * `@auditforge/db`; this is a soft cross-reference.
   *
   * TODO(@auditforge/db): replace with a typed reference to the competence
   * record once db schema lands.
   */
  readonly competenceEvidenceRefs?: readonly string[];
}

export interface AuditTeam {
  readonly engagementId: EngagementId;
  readonly assignments: readonly RoleAssignment[];
}

/**
 * Result of running an impartiality check for a single auditor against
 * a single client.
 *
 * Per ISO/IEC 17021-1:2015 clause 5.2 + Annex C, the auditor must not
 * have provided consultancy / management-system advisory services to the
 * client in a configurable lookback window (default 2 years).
 */
export interface ImpartialityCheck {
  readonly auditorId: AuditorId;
  readonly clientId: ClientId;
  readonly verdict: 'clear' | 'conflict';
  readonly reasons: readonly ImpartialityReason[];
  /** Lookback window applied (years) */
  readonly lookbackYears: number;
}

export type ImpartialityReason =
  | { kind: 'consulted_for_client'; consultedAt: string; description: string }
  | { kind: 'employment_with_client'; from: string; to?: string }
  | { kind: 'family_relationship'; description: string }
  | { kind: 'financial_interest'; description: string }
  | { kind: 'previous_audit_too_recent'; previousAuditDate: string };

export interface AuditorRelationship {
  readonly auditorId: AuditorId;
  readonly clientId: ClientId;
  readonly kind: ImpartialityReason['kind'];
  /** ISO 8601 date — when the relationship started (or the consult occurred) */
  readonly startedAt: string;
  /** Optional end date; if absent, treated as ongoing */
  readonly endedAt?: string;
  readonly description: string;
}
