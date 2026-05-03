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
} from '../types.js';

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
