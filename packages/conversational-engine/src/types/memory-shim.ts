// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-7.5): switch to @auditforge/audit-memory once available.
//
// Minimal local types/interfaces mirroring what we will pull from the
// audit-memory package. Kept narrow on purpose: only what this package
// actually consumes.

import type { ClaimId, ClauseId, EngagementId, EpisodeId, ModelInvocationId } from './ids.js';
import type { ContradictionRecord, ExtractedClaim, RetrievalCandidate } from './domain.js';

export interface RawAnswer {
  readonly engagementId: EngagementId;
  readonly questionInvocationId: string;
  readonly auditeeText: string;
  readonly attachedEvidenceIds: readonly string[];
  readonly capturedAt: string;
}

export interface EpisodeStore {
  write(answer: RawAnswer): Promise<EpisodeId>;
}

export interface ClaimExtractor {
  extract(input: {
    readonly episodeId: EpisodeId;
    readonly text: string;
  }): Promise<{ readonly claims: readonly ExtractedClaim[]; readonly modelInvocationId: ModelInvocationId | null }>;
}

export interface HybridRetrievalService {
  retrieve(input: {
    readonly claim: ExtractedClaim;
    readonly limit: number;
  }): Promise<readonly RetrievalCandidate[]>;
}

export interface ClauseCatalog {
  has(clauseId: ClauseId): boolean;
  list(): readonly ClauseId[];
  textFor(clauseId: ClauseId): string | undefined;
}

export interface ClaimGraphReader {
  findContradictions(input: {
    readonly engagementId: EngagementId;
    readonly claim: ExtractedClaim;
  }): Promise<readonly ContradictionRecord[]>;
}

export interface CompletionLogEntry {
  readonly invocationId: ModelInvocationId;
  readonly purpose: string;
  readonly model: string;
  readonly tier: 'small' | 'medium' | 'large' | 'reasoning';
}

export interface ReRankerInput {
  readonly claim: ExtractedClaim;
  readonly candidates: readonly RetrievalCandidate[];
}

export interface ReRankerJudgment {
  readonly clauseId: string;
  readonly confidence: number;
  readonly rationale: string;
}

export interface ReRanker {
  rank(input: ReRankerInput): Promise<{
    readonly judgments: readonly ReRankerJudgment[];
    readonly modelInvocationId: ModelInvocationId | null;
  }>;
}

export interface QuestionContextualizer {
  rewrite(input: {
    readonly libraryText: string;
    readonly engagementContext: string;
  }): Promise<{ readonly text: string; readonly modelInvocationId: ModelInvocationId | null }>;
}

export interface WorkingPaperLinkerInput {
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly claimId: ClaimId;
  readonly episodeId: EpisodeId;
}

export interface WorkingPaperLinker {
  link(input: WorkingPaperLinkerInput): Promise<{ readonly workingPaperId: string }>;
}
