// SPDX-License-Identifier: BUSL-1.1
/**
 * Tool registry. Each tool exports a `definition` (schema + description) and a
 * `handler`. The dispatcher in `server.ts` looks them up by name.
 *
 * Tool descriptions are pinned. Changing them requires bumping the server
 * version (anti-tool-poisoning per P-MCP-01 research).
 */

import { z } from 'zod';

import type {
  AuditDataPort,
  EngagementId,
  Principal,
  EngagementRecord,
  FindingRecord,
  CandidateFindingRecord,
  CoverageStateRecord,
  ClaimRecord,
  EngagementSummary,
  FollowupQuestion,
  LibraryQuestionRecord,
  ReportRecord,
  WorkingPaperRecord,
} from '../types.js';
import type { McpReceiptSigner } from '../signing.js';

export interface ToolDefinition<TInput, TOutput> {
  readonly name: string;
  /** Pinned description; never includes hidden instructions. */
  readonly description: string;
  /** Hash of `{ name, description, inputSchema serialized }`. */
  readonly fingerprint: string;
  readonly inputSchema: z.ZodType<TInput>;
  /** Optional output schema for structured outputs (MCP 2026 supports this). */
  readonly outputSchema: z.ZodType<TOutput>;
}

export interface ToolHandler<TInput, TOutput> {
  readonly definition: ToolDefinition<TInput, TOutput>;
  readonly handle: (
    principal: Principal,
    input: TInput,
    deps: ToolDeps,
  ) => Promise<TOutput>;
  /**
   * Returns the engagementId implicit in the input (or null if the tool is
   * engagement-agnostic). Used by the dispatcher to apply the membership
   * check.
   */
  readonly engagementOf: (input: TInput) => EngagementId | null;
}

export interface ToolDeps {
  readonly data: AuditDataPort;
  readonly emitLlm: (entry: {
    readonly engagementId: string;
    readonly purpose: string;
    readonly model: string | null;
    readonly tier: 'small' | 'medium' | 'large' | 'reasoning';
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly latencyMs: number;
    readonly costUsd: number;
  }) => Promise<string>;
  readonly receiptSigner?: McpReceiptSigner | null;
  readonly serverVersion: string;
}

import { fingerprintTool } from './fingerprint.js';

// ---------- list_engagements ---------------------------------------------

const ListEngagementsInput = z
  .object({
    status: z.enum(['planned', 'active', 'closed', 'archived']).optional(),
    mode: z.enum(['audit', 'readiness']).optional(),
    leadAuditorId: z.string().min(1).optional(),
  })
  .strict();
export type ListEngagementsInputT = z.infer<typeof ListEngagementsInput>;

const EngagementSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  auditeeName: z.string(),
  mode: z.enum(['audit', 'readiness']),
  phase: z.enum(['S1', 'S2', 'Surv', 'Recert', 'Special', 'Readiness']),
  leadAuditorId: z.string(),
  memberAuditorIds: z.array(z.string()),
  status: z.enum(['planned', 'active', 'closed', 'archived']),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
});
const ListEngagementsOutput = z.array(EngagementSchema);
export type ListEngagementsOutputT = z.infer<typeof ListEngagementsOutput>;

export const listEngagementsDef: ToolDefinition<ListEngagementsInputT, ListEngagementsOutputT> = {
  name: 'list_engagements',
  description:
    'List ISO 42001 engagements visible to the caller. Returns id, firmId, auditeeName, mode, phase, status, lead and member auditor ids, opened/closed timestamps. Filters: status, mode, leadAuditorId.',
  fingerprint: '',
  inputSchema: ListEngagementsInput,
  outputSchema: ListEngagementsOutput,
};
(listEngagementsDef as { fingerprint: string }).fingerprint = fingerprintTool(listEngagementsDef);

export const listEngagements: ToolHandler<ListEngagementsInputT, ListEngagementsOutputT> = {
  definition: listEngagementsDef,
  engagementOf: () => null,
  handle: async (p, input, deps) => {
    const rows = await deps.data.listEngagements(p, {
      ...(input.status ? { status: input.status } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.leadAuditorId ? { leadAuditorId: input.leadAuditorId } : {}),
    });
    return rows.map(toEngagementOut);
  },
};

// ---------- get_engagement ------------------------------------------------

const GetEngagementInput = z.object({ engagementId: z.string().min(1) }).strict();
export type GetEngagementInputT = z.infer<typeof GetEngagementInput>;
const GetEngagementOutput = EngagementSchema.nullable();
export type GetEngagementOutputT = z.infer<typeof GetEngagementOutput>;

export const getEngagementDef: ToolDefinition<GetEngagementInputT, GetEngagementOutputT> = {
  name: 'get_engagement',
  description:
    'Get a single engagement by id. Caller must be provisioned against the engagement (membership-checked). Returns null when not found or access denied.',
  fingerprint: '',
  inputSchema: GetEngagementInput,
  outputSchema: GetEngagementOutput,
};
(getEngagementDef as { fingerprint: string }).fingerprint = fingerprintTool(getEngagementDef);

export const getEngagement: ToolHandler<GetEngagementInputT, GetEngagementOutputT> = {
  definition: getEngagementDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const row = await deps.data.getEngagement(p, input.engagementId);
    return row ? toEngagementOut(row) : null;
  },
};

// ---------- list_findings -------------------------------------------------

const FindingStatus = z.enum(['draft', 'open', 'in-review', 'closed', 'rejected']);
const FindingType = z.enum(['major-nc', 'minor-nc', 'ofi', 'observation']);

const ListFindingsInput = z
  .object({
    engagementId: z.string().min(1),
    status: FindingStatus.optional(),
  })
  .strict();
export type ListFindingsInputT = z.infer<typeof ListFindingsInput>;

const FindingSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  type: FindingType,
  status: FindingStatus,
  clauseIds: z.array(z.string()),
  statement: z.string(),
  createdAt: z.string(),
});
const ListFindingsOutput = z.array(FindingSchema);
export type ListFindingsOutputT = z.infer<typeof ListFindingsOutput>;

export const listFindingsDef: ToolDefinition<ListFindingsInputT, ListFindingsOutputT> = {
  name: 'list_findings',
  description:
    'List confirmed findings for an engagement. Filter by status (draft|open|in-review|closed|rejected). Returns formal Findings only — candidate findings have a separate tool.',
  fingerprint: '',
  inputSchema: ListFindingsInput,
  outputSchema: ListFindingsOutput,
};
(listFindingsDef as { fingerprint: string }).fingerprint = fingerprintTool(listFindingsDef);

export const listFindings: ToolHandler<ListFindingsInputT, ListFindingsOutputT> = {
  definition: listFindingsDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const rows = await deps.data.listFindings(p, input.engagementId, input.status);
    return rows.map(toFindingOut);
  },
};

// ---------- get_candidate_findings ----------------------------------------

const GetCandidateFindingsInput = z.object({ engagementId: z.string().min(1) }).strict();
export type GetCandidateFindingsInputT = z.infer<typeof GetCandidateFindingsInput>;

const CandidateFindingSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  proposedType: FindingType,
  clauseIds: z.array(z.string()),
  draftStatement: z.string(),
  confidence: z.number(),
  sourceClaimIds: z.array(z.string()),
  createdAt: z.string(),
});
const CandidateFindingsOutput = z.array(CandidateFindingSchema);
export type CandidateFindingsOutputT = z.infer<typeof CandidateFindingsOutput>;

export const getCandidateFindingsDef: ToolDefinition<GetCandidateFindingsInputT, CandidateFindingsOutputT> = {
  name: 'get_candidate_findings',
  description:
    'Get candidate findings drafted by the Parallel NC Drafter. Lead auditor only: candidates are drafts pending auditor review and never visible to auditees.',
  fingerprint: '',
  inputSchema: GetCandidateFindingsInput,
  outputSchema: CandidateFindingsOutput,
};
(getCandidateFindingsDef as { fingerprint: string }).fingerprint = fingerprintTool(getCandidateFindingsDef);

export const getCandidateFindings: ToolHandler<GetCandidateFindingsInputT, CandidateFindingsOutputT> = {
  definition: getCandidateFindingsDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const rows = await deps.data.getCandidateFindings(p, input.engagementId);
    return rows.map(toCandidateOut);
  },
};

// ---------- get_coverage_state --------------------------------------------

const GetCoverageInput = z.object({ engagementId: z.string().min(1) }).strict();
export type GetCoverageInputT = z.infer<typeof GetCoverageInput>;

const CoverageSchema = z.object({
  engagementId: z.string(),
  clauseId: z.string(),
  status: z.enum(['untouched', 'partial', 'evidenced', 'contradicted', 'na']),
  confidence: z.number(),
  lastUpdate: z.string(),
});
const CoverageOutput = z.array(CoverageSchema);
export type CoverageOutputT = z.infer<typeof CoverageOutput>;

export const getCoverageStateDef: ToolDefinition<GetCoverageInputT, CoverageOutputT> = {
  name: 'get_coverage_state',
  description:
    'Get per-clause coverage state for an engagement. Returns one row per in-scope clause with status (untouched|partial|evidenced|contradicted|na), confidence, and last-update timestamp.',
  fingerprint: '',
  inputSchema: GetCoverageInput,
  outputSchema: CoverageOutput,
};
(getCoverageStateDef as { fingerprint: string }).fingerprint = fingerprintTool(getCoverageStateDef);

export const getCoverageState: ToolHandler<GetCoverageInputT, CoverageOutputT> = {
  definition: getCoverageStateDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const rows = await deps.data.getCoverageState(p, input.engagementId);
    return rows.map(toCoverageOut);
  },
};

// ---------- draft_followup_question ---------------------------------------

const DraftFollowupInput = z
  .object({
    engagementId: z.string().min(1),
    claimId: z.string().min(1),
  })
  .strict();
export type DraftFollowupInputT = z.infer<typeof DraftFollowupInput>;

const FollowupSchema = z.object({
  text: z.string(),
  libraryRefId: z.string().nullable(),
  mappedClauses: z.array(z.string()),
  modelInvocationId: z.string().nullable(),
});
export type FollowupOutputT = z.infer<typeof FollowupSchema>;

export const draftFollowupDef: ToolDefinition<DraftFollowupInputT, FollowupOutputT> = {
  name: 'draft_followup_question',
  description:
    'Draft a follow-up question for the given claim. Calls the conversational engine internally; emits an llm_invocations row. Returns the question text, source library ref, mapped clauses, and the invocation id for traceability.',
  fingerprint: '',
  inputSchema: DraftFollowupInput,
  outputSchema: FollowupSchema,
};
(draftFollowupDef as { fingerprint: string }).fingerprint = fingerprintTool(draftFollowupDef);

export const draftFollowup: ToolHandler<DraftFollowupInputT, FollowupOutputT> = {
  definition: draftFollowupDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const claim = await deps.data.getClaim(p, input.engagementId, input.claimId);
    if (!claim) {
      throw new ToolError('mcp.tool.not_found', `claim ${input.claimId} not found`);
    }
    const t0 = Date.now();
    const followup: FollowupQuestion = await deps.data.draftFollowup(p, claim);
    const tokensIn = Math.max(1, Math.floor(claim.text.length / 4));
    const tokensOut = Math.max(1, Math.floor(followup.text.length / 4));
    const invocationId = await deps.emitLlm({
      engagementId: input.engagementId,
      purpose: 'mcp.draft_followup_question',
      model: null,
      tier: 'medium',
      tokensIn,
      tokensOut,
      latencyMs: Date.now() - t0,
      costUsd: 0,
    });
    return {
      text: followup.text,
      libraryRefId: followup.libraryRefId,
      mappedClauses: [...followup.mappedClauses],
      modelInvocationId: followup.modelInvocationId ?? invocationId,
    };
  },
};

// ---------- summarize_engagement ------------------------------------------

const SummarizeInput = z.object({ engagementId: z.string().min(1) }).strict();
export type SummarizeInputT = z.infer<typeof SummarizeInput>;

const SummarySchema = z.object({
  engagementId: z.string(),
  coveragePct: z.number(),
  findingCounts: z.object({
    majorNc: z.number(),
    minorNc: z.number(),
    ofi: z.number(),
    observation: z.number(),
  }),
  openCandidateCount: z.number(),
  recommendation: z.enum([
    'conformity',
    'conformity-pending-capa',
    'nonconformity',
    'inconclusive',
  ]),
  text: z.string(),
});
export type SummaryOutputT = z.infer<typeof SummarySchema>;

export const summarizeDef: ToolDefinition<SummarizeInputT, SummaryOutputT> = {
  name: 'summarize_engagement',
  description:
    'Summarize an engagement: coverage %, finding counts by type, open candidate count, and a recommendation (conformity|conformity-pending-capa|nonconformity|inconclusive). The recommendation is a draft only — the auditor concludes.',
  fingerprint: '',
  inputSchema: SummarizeInput,
  outputSchema: SummarySchema,
};
(summarizeDef as { fingerprint: string }).fingerprint = fingerprintTool(summarizeDef);

export const summarizeEngagement: ToolHandler<SummarizeInputT, SummaryOutputT> = {
  definition: summarizeDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const t0 = Date.now();
    const s = await deps.data.computeSummary(p, input.engagementId);
    if (!s) {
      throw new ToolError('mcp.tool.not_found', `engagement ${input.engagementId} not found`);
    }
    await deps.emitLlm({
      engagementId: input.engagementId,
      purpose: 'mcp.summarize_engagement',
      model: null,
      tier: 'medium',
      tokensIn: 200,
      tokensOut: Math.max(50, Math.floor(s.text.length / 4)),
      latencyMs: Date.now() - t0,
      costUsd: 0,
    });
    return toSummaryOut(s);
  },
};

// ---------- search_claims -------------------------------------------------

const SearchClaimsInput = z
  .object({
    engagementId: z.string().min(1),
    query: z.string().min(1).max(500),
  })
  .strict();
export type SearchClaimsInputT = z.infer<typeof SearchClaimsInput>;

const ClaimSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  text: z.string(),
  extractedAt: z.string(),
});
const SearchClaimsOutput = z.array(ClaimSchema);
export type SearchClaimsOutputT = z.infer<typeof SearchClaimsOutput>;

export const searchClaimsDef: ToolDefinition<SearchClaimsInputT, SearchClaimsOutputT> = {
  name: 'search_claims',
  description:
    'Search claims for an engagement. Returns subject/predicate/object triples extracted from auditee answers along with the original answer text. Engagement-scoped: cross-engagement queries are not possible by design.',
  fingerprint: '',
  inputSchema: SearchClaimsInput,
  outputSchema: SearchClaimsOutput,
};
(searchClaimsDef as { fingerprint: string }).fingerprint = fingerprintTool(searchClaimsDef);

export const searchClaims: ToolHandler<SearchClaimsInputT, SearchClaimsOutputT> = {
  definition: searchClaimsDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const rows = await deps.data.searchClaims(p, input.engagementId, input.query);
    return rows.map(toClaimOut);
  },
};

// ---------- library.search ------------------------------------------------

const LibrarySearchInput = z
  .object({
    query: z.string().min(1).max(500),
    clauseFilter: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type LibrarySearchInputT = z.infer<typeof LibrarySearchInput>;

const LibraryQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  clauseIds: z.array(z.string()),
  score: z.number(),
});
const LibrarySearchOutput = z.array(LibraryQuestionSchema);
export type LibrarySearchOutputT = z.infer<typeof LibrarySearchOutput>;

export const librarySearchDef: ToolDefinition<LibrarySearchInputT, LibrarySearchOutputT> = {
  name: 'library.search',
  description:
    'Search the question library by free-text query, optionally filtered by clauseIds. Returns library question id, text, mapped clauses, and a relevance score. Engagement-agnostic; the library is firm-global.',
  fingerprint: '',
  inputSchema: LibrarySearchInput,
  outputSchema: LibrarySearchOutput,
};
(librarySearchDef as { fingerprint: string }).fingerprint = fingerprintTool(librarySearchDef);

export const librarySearch: ToolHandler<LibrarySearchInputT, LibrarySearchOutputT> = {
  definition: librarySearchDef,
  engagementOf: () => null,
  handle: async (p, input, deps) => {
    const rows = await deps.data.searchLibrary(
      p,
      input.query,
      input.clauseFilter ?? null,
      input.limit ?? 10,
    );
    return rows.map(toLibraryOut);
  },
};

// ---------- working-paper.read --------------------------------------------

const WorkingPaperReadInput = z
  .object({
    engagementId: z.string().min(1),
    workingPaperId: z.string().min(1),
  })
  .strict();
export type WorkingPaperReadInputT = z.infer<typeof WorkingPaperReadInput>;

const WorkingPaperReadOutput = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    clauseId: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'final']),
    content: z.string(),
    updatedAt: z.string(),
  })
  .nullable();
export type WorkingPaperReadOutputT = z.infer<typeof WorkingPaperReadOutput>;

export const workingPaperReadDef: ToolDefinition<WorkingPaperReadInputT, WorkingPaperReadOutputT> = {
  name: 'working-paper.read',
  description:
    'Read a single working paper. Read-only. Write operations are intentionally NOT exposed via MCP — auditor confirmation lives in the web UI.',
  fingerprint: '',
  inputSchema: WorkingPaperReadInput,
  outputSchema: WorkingPaperReadOutput,
};
(workingPaperReadDef as { fingerprint: string }).fingerprint = fingerprintTool(workingPaperReadDef);

export const workingPaperRead: ToolHandler<WorkingPaperReadInputT, WorkingPaperReadOutputT> = {
  definition: workingPaperReadDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const wp = await deps.data.getWorkingPaper(p, input.engagementId, input.workingPaperId);
    if (!wp) return null;
    return toWorkingPaperOut(wp);
  },
};

// ---------- report.list ---------------------------------------------------

const ReportListInput = z.object({ engagementId: z.string().min(1) }).strict();
export type ReportListInputT = z.infer<typeof ReportListInput>;

const ReportSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  kind: z.enum(['draft', 'final', 'readiness']),
  status: z.enum(['draft', 'pending-signature', 'published']),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});
const ReportListOutput = z.array(ReportSchema);
export type ReportListOutputT = z.infer<typeof ReportListOutput>;

export const reportListDef: ToolDefinition<ReportListInputT, ReportListOutputT> = {
  name: 'report.list',
  description:
    'List reports (draft, final, readiness) for an engagement. Returns id, kind, status, createdAt, publishedAt. Read-only.',
  fingerprint: '',
  inputSchema: ReportListInput,
  outputSchema: ReportListOutput,
};
(reportListDef as { fingerprint: string }).fingerprint = fingerprintTool(reportListDef);

export const reportList: ToolHandler<ReportListInputT, ReportListOutputT> = {
  definition: reportListDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    const rows = await deps.data.listReports(p, input.engagementId);
    return rows.map(toReportOut);
  },
};

// ---------- report.publish ------------------------------------------------

const ReportPublishInput = z
  .object({
    engagementId: z.string().min(1),
    reportId: z.string().min(1),
    confirmationToken: z.string().min(8),
  })
  .strict();
export type ReportPublishInputT = z.infer<typeof ReportPublishInput>;

const ReportPublishOutput = z.object({
  id: z.string(),
  engagementId: z.string(),
  status: z.literal('published'),
  publishedAt: z.string(),
  signature: z.object({
    keyId: z.string(),
    algorithm: z.string(),
    signatureBase64: z.string(),
  }),
});
export type ReportPublishOutputT = z.infer<typeof ReportPublishOutput>;

export const reportPublishDef: ToolDefinition<ReportPublishInputT, ReportPublishOutputT> = {
  name: 'report.publish',
  description:
    'Publish a finalised report. Requires a single-use confirmationToken minted via the web UI consent flow. Emits a signed Ed25519 receipt to the audit ledger. Without a valid token, the call is rejected with mcp.tool.confirmation_required.',
  fingerprint: '',
  inputSchema: ReportPublishInput,
  outputSchema: ReportPublishOutput,
};
(reportPublishDef as { fingerprint: string }).fingerprint = fingerprintTool(reportPublishDef);

export const reportPublish: ToolHandler<ReportPublishInputT, ReportPublishOutputT> = {
  definition: reportPublishDef,
  engagementOf: (i) => i.engagementId,
  handle: async (p, input, deps) => {
    if (!deps.receiptSigner) {
      throw new ToolError(
        'mcp.tool.unavailable',
        'report.publish requires a configured receipt signer; not provisioned in this environment',
      );
    }
    const r = await deps.data.publishReport(p, input.engagementId, input.reportId, input.confirmationToken);
    if (!r) {
      throw new ToolError(
        'mcp.tool.confirmation_required',
        `report ${input.reportId} not found or confirmation token invalid`,
      );
    }
    const receipt = await deps.receiptSigner.sign({
      tool: 'report.publish',
      engagementId: input.engagementId,
      auditorId: p.auditorId,
      reportId: r.id,
      publishedAt: r.publishedAt ?? '',
    });
    return {
      id: r.id,
      engagementId: r.engagementId,
      status: 'published',
      publishedAt: r.publishedAt ?? '',
      signature: {
        keyId: receipt.keyId,
        algorithm: receipt.algorithm,
        signatureBase64: receipt.signatureBase64,
      },
    };
  },
};

// ---------- aiSystemInventory.profile -------------------------------------

const AiInvProfileInput = z.object({}).strict();
export type AiInvProfileInputT = z.infer<typeof AiInvProfileInput>;

const AiInvProfileOutput = z.object({
  modelName: z.literal('auditforge-mcp'),
  version: z.string(),
  purpose: z.string(),
  capabilities: z.array(z.string()),
  limitations: z.array(z.string()),
  dataAccess: z.object({
    scope: z.literal('per-engagement'),
    pii: z.boolean(),
    cloudEgress: z.boolean(),
  }),
  governance: z.object({
    standard: z.literal('ISO/IEC 42001'),
    auditTrail: z.literal('ed25519-signed-receipts'),
    confirmationRequired: z.array(z.string()),
  }),
});
export type AiInvProfileOutputT = z.infer<typeof AiInvProfileOutput>;

export const aiInvProfileDef: ToolDefinition<AiInvProfileInputT, AiInvProfileOutputT> = {
  name: 'aiSystemInventory.profile',
  description:
    'Return the AuditForge MCP server\'s own AI System Inventory profile. ISO 42001 Annex A.6.2 requires inventorying every AI system the organisation deploys — including its own internal AI tooling. AuditForge profiles itself.',
  fingerprint: '',
  inputSchema: AiInvProfileInput,
  outputSchema: AiInvProfileOutput,
};
(aiInvProfileDef as { fingerprint: string }).fingerprint = fingerprintTool(aiInvProfileDef);

export const aiInvProfile: ToolHandler<AiInvProfileInputT, AiInvProfileOutputT> = {
  definition: aiInvProfileDef,
  engagementOf: () => null,
  handle: async (_p, _input, deps) => ({
    modelName: 'auditforge-mcp',
    version: deps.serverVersion,
    purpose:
      'MCP gateway exposing AuditForge engagement data (engagements, findings, candidate findings, coverage, claims, library, working papers, reports) to MCP-compatible clients used by ISO/IEC 42001 Lead Auditors.',
    capabilities: [
      'list/get engagements (RBAC-scoped)',
      'list findings + candidate findings',
      'coverage state per clause',
      'claim search (engagement-scoped)',
      'library question search',
      'working paper read (read-only)',
      'report list + report publish (publish requires confirmation token)',
      'follow-up question drafting (LLM-backed; emits llm_invocations)',
    ],
    limitations: [
      'no write operations beyond report.publish',
      'cross-engagement queries disabled by RBAC',
      'auditee role denied on every tool',
      'no auto-promotion of candidate findings',
    ],
    dataAccess: {
      scope: 'per-engagement',
      pii: true,
      cloudEgress: false,
    },
    governance: {
      standard: 'ISO/IEC 42001',
      auditTrail: 'ed25519-signed-receipts',
      confirmationRequired: ['report.publish'],
    },
  }),
};

// -------------------------------------------------------------------------

export class ToolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ToolError';
  }
}

export const ALL_TOOLS: readonly ToolHandler<unknown, unknown>[] = [
  listEngagements as unknown as ToolHandler<unknown, unknown>,
  getEngagement as unknown as ToolHandler<unknown, unknown>,
  listFindings as unknown as ToolHandler<unknown, unknown>,
  getCandidateFindings as unknown as ToolHandler<unknown, unknown>,
  getCoverageState as unknown as ToolHandler<unknown, unknown>,
  draftFollowup as unknown as ToolHandler<unknown, unknown>,
  summarizeEngagement as unknown as ToolHandler<unknown, unknown>,
  searchClaims as unknown as ToolHandler<unknown, unknown>,
  librarySearch as unknown as ToolHandler<unknown, unknown>,
  workingPaperRead as unknown as ToolHandler<unknown, unknown>,
  reportList as unknown as ToolHandler<unknown, unknown>,
  reportPublish as unknown as ToolHandler<unknown, unknown>,
  aiInvProfile as unknown as ToolHandler<unknown, unknown>,
];

export function toolByName(name: string): ToolHandler<unknown, unknown> | null {
  for (const t of ALL_TOOLS) {
    if (t.definition.name === name) return t;
  }
  return null;
}

/** Defensive deep-clone for handler outputs so callers never mutate cache. */
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

// JSON-cloning strips `readonly` markers from inferred types. The handlers
// declare their outputs via Zod-inferred types, which are mutable; we coerce
// via `unknown` rather than forcing the data port surface to be mutable.
function toEngagementOut(r: EngagementRecord): ListEngagementsOutputT[number] {
  return clone(r) as unknown as ListEngagementsOutputT[number];
}
function toFindingOut(r: FindingRecord): ListFindingsOutputT[number] {
  return clone(r) as unknown as ListFindingsOutputT[number];
}
function toCandidateOut(r: CandidateFindingRecord): CandidateFindingsOutputT[number] {
  return clone(r) as unknown as CandidateFindingsOutputT[number];
}
function toCoverageOut(r: CoverageStateRecord): CoverageOutputT[number] {
  return clone(r) as unknown as CoverageOutputT[number];
}
function toClaimOut(r: ClaimRecord): SearchClaimsOutputT[number] {
  return clone(r) as unknown as SearchClaimsOutputT[number];
}
function toSummaryOut(s: EngagementSummary): SummaryOutputT {
  return clone(s) as unknown as SummaryOutputT;
}
function toLibraryOut(r: LibraryQuestionRecord): LibrarySearchOutputT[number] {
  return clone(r) as unknown as LibrarySearchOutputT[number];
}
function toWorkingPaperOut(r: WorkingPaperRecord): NonNullable<WorkingPaperReadOutputT> {
  return {
    id: r.id,
    engagementId: r.engagementId,
    clauseId: r.clauseId,
    title: r.title,
    status: r.status,
    content: r.content ?? '',
    updatedAt: r.updatedAt,
  };
}
function toReportOut(r: ReportRecord): ReportListOutputT[number] {
  return {
    id: r.id,
    engagementId: r.engagementId,
    kind: r.kind,
    status: r.status,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt,
  };
}
