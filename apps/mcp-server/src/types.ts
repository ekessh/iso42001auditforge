// SPDX-License-Identifier: BUSL-1.1
/**
 * Shared types for the MCP server. Narrow on purpose: only what we need to
 * dispatch tools, enforce RBAC, and emit audit events.
 */

export type AuditorId = string;
export type EngagementId = string;
export type FirmId = string;
export type FindingId = string;
export type ClaimId = string;
export type ClauseId = string;

/**
 * Auditor roles. Mirrors the v2 role system (auth-core).
 */
export const AUDITOR_ROLES = [
  'lead_auditor',
  'team_auditor',
  'peer_reviewer',
  'audit_manager',
  'firm_admin',
  'technical_expert',
  'auditee',
] as const;
export type AuditorRole = (typeof AUDITOR_ROLES)[number];

/**
 * The validated principal a tool receives at dispatch time. Produced by the
 * AuthGateway from the OAuth access token.
 */
export interface Principal {
  readonly auditorId: AuditorId;
  readonly firmId: FirmId;
  readonly roles: readonly AuditorRole[];
  /** Engagement IDs this principal is provisioned against. */
  readonly engagements: readonly EngagementId[];
  /** OAuth `sub` echoed for ledger correlation. */
  readonly sub: string;
  /** Token id for ledger correlation; never the raw token. */
  readonly tokenId: string;
}

/** Shape of the `Engagement` row returned by tools. Subset of v2 model. */
export interface EngagementRecord {
  readonly id: EngagementId;
  readonly firmId: FirmId;
  readonly auditeeName: string;
  readonly mode: 'audit' | 'readiness';
  readonly phase: 'S1' | 'S2' | 'Surv' | 'Recert' | 'Special' | 'Readiness';
  readonly leadAuditorId: AuditorId;
  readonly memberAuditorIds: readonly AuditorId[];
  readonly status: 'planned' | 'active' | 'closed' | 'archived';
  readonly openedAt: string;
  readonly closedAt: string | null;
}

export interface FindingRecord {
  readonly id: FindingId;
  readonly engagementId: EngagementId;
  readonly type: 'major-nc' | 'minor-nc' | 'ofi' | 'observation';
  readonly status: 'draft' | 'open' | 'in-review' | 'closed' | 'rejected';
  readonly clauseIds: readonly ClauseId[];
  readonly statement: string;
  readonly createdAt: string;
}

export interface CandidateFindingRecord {
  readonly id: string;
  readonly engagementId: EngagementId;
  readonly proposedType: 'major-nc' | 'minor-nc' | 'ofi' | 'observation';
  readonly clauseIds: readonly ClauseId[];
  readonly draftStatement: string;
  readonly confidence: number;
  readonly sourceClaimIds: readonly ClaimId[];
  readonly createdAt: string;
}

export interface ClaimRecord {
  readonly id: ClaimId;
  readonly engagementId: EngagementId;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly text: string;
  readonly extractedAt: string;
}

export interface CoverageStateRecord {
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly status: 'untouched' | 'partial' | 'evidenced' | 'contradicted' | 'na';
  readonly confidence: number;
  readonly lastUpdate: string;
}

export interface WorkingPaperRecord {
  readonly id: string;
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly title: string;
  readonly status: 'draft' | 'final';
  readonly updatedAt: string;
  readonly content?: string;
}

export interface LibraryQuestionRecord {
  readonly id: string;
  readonly text: string;
  readonly clauseIds: readonly ClauseId[];
  readonly score: number;
}

export interface ReportRecord {
  readonly id: string;
  readonly engagementId: EngagementId;
  readonly kind: 'draft' | 'final' | 'readiness';
  readonly status: 'draft' | 'pending-signature' | 'published';
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly contentHash?: string;
}

export interface FollowupQuestion {
  readonly text: string;
  readonly libraryRefId: string | null;
  readonly mappedClauses: readonly ClauseId[];
  readonly modelInvocationId: string | null;
}

export interface EngagementSummary {
  readonly engagementId: EngagementId;
  readonly coveragePct: number;
  readonly findingCounts: {
    readonly majorNc: number;
    readonly minorNc: number;
    readonly ofi: number;
    readonly observation: number;
  };
  readonly openCandidateCount: number;
  readonly recommendation:
    | 'conformity'
    | 'conformity-pending-capa'
    | 'nonconformity'
    | 'inconclusive';
  readonly text: string;
}

/**
 * Data port the tools talk to. The integration layer wires this to the v2
 * NestJS modules; tests provide an in-memory implementation.
 *
 * Methods are membership-checked: implementations MUST return `null` /
 * empty array when the principal is not provisioned against the engagement.
 */
export interface AuditDataPort {
  listEngagements(p: Principal, filters: ListEngagementsFilters): Promise<readonly EngagementRecord[]>;
  getEngagement(p: Principal, id: EngagementId): Promise<EngagementRecord | null>;
  listFindings(p: Principal, engagementId: EngagementId, status?: FindingRecord['status']): Promise<readonly FindingRecord[]>;
  getCandidateFindings(p: Principal, engagementId: EngagementId): Promise<readonly CandidateFindingRecord[]>;
  getCoverageState(p: Principal, engagementId: EngagementId): Promise<readonly CoverageStateRecord[]>;
  searchClaims(p: Principal, engagementId: EngagementId, query: string): Promise<readonly ClaimRecord[]>;
  getClaim(p: Principal, engagementId: EngagementId, claimId: ClaimId): Promise<ClaimRecord | null>;
  listWorkingPapers(p: Principal, engagementId: EngagementId): Promise<readonly WorkingPaperRecord[]>;
  getWorkingPaper(p: Principal, engagementId: EngagementId, workingPaperId: string): Promise<WorkingPaperRecord | null>;
  computeSummary(p: Principal, engagementId: EngagementId): Promise<EngagementSummary | null>;
  draftFollowup(p: Principal, claim: ClaimRecord): Promise<FollowupQuestion>;
  searchLibrary(p: Principal, query: string, clauseFilter: readonly ClauseId[] | null, limit: number): Promise<readonly LibraryQuestionRecord[]>;
  listReports(p: Principal, engagementId: EngagementId): Promise<readonly ReportRecord[]>;
  publishReport(p: Principal, engagementId: EngagementId, reportId: string, confirmationToken: string): Promise<ReportRecord | null>;
}

export interface ListEngagementsFilters {
  readonly status?: EngagementRecord['status'];
  readonly mode?: EngagementRecord['mode'];
  readonly leadAuditorId?: AuditorId;
}

/**
 * Audit ledger event emitted on every MCP request. Stored in the audit ledger
 * (immutable) and a row is also written to `llm_invocations` when a tool calls
 * the conversational engine.
 */
export interface McpLedgerEvent {
  readonly type: 'mcp.tool.invoked' | 'mcp.resource.read' | 'mcp.auth.denied';
  readonly occurredAt: string;
  readonly actorId: AuditorId | null;
  readonly firmId: FirmId | null;
  readonly tokenId: string | null;
  readonly engagementId: EngagementId | null;
  readonly tool: string | null;
  readonly resource: string | null;
  readonly paramsHash: string;
  readonly verdict: 'allowed' | 'denied' | 'error';
  readonly errorCode: string | null;
  readonly latencyMs: number;
}

export interface LlmInvocationEntry {
  readonly invocationId: string;
  readonly engagementId: EngagementId;
  readonly purpose: string;
  readonly model: string | null;
  readonly tier: 'small' | 'medium' | 'large' | 'reasoning';
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly occurredAt: string;
}

/** Sink the server uses to persist audit events. Pluggable for tests. */
export interface AuditLedgerSink {
  emit(event: McpLedgerEvent): Promise<void>;
  emitLlm(entry: LlmInvocationEntry): Promise<void>;
}

/** Generic structured logger. */
export interface McpLogger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}
