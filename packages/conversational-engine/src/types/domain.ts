// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import type { ClauseId, ClaimId, EngagementId, EpisodeId, FirmId, ModelInvocationId, QuestionLibraryId, WorkingPaperId } from './ids.js';

export const AI_SYSTEM_KINDS = [
  'llm',
  'predictive-ml',
  'agent',
  'rag',
  'multi-agent',
  'training-pipeline',
  'mcp-server',
  'vector-db',
] as const;
export type AiSystemKind = (typeof AI_SYSTEM_KINDS)[number];

export const AUDIT_PHASES = [
  'S1',
  'S2',
  'Surv',
  'Recert',
  'Special',
  'Readiness',
] as const;
export type AuditPhase = (typeof AUDIT_PHASES)[number];

export const EVIDENCE_TYPES = [
  'policy',
  'procedure',
  'record',
  'log',
  'screenshot',
  'config',
  'training-record',
  'risk-register-entry',
  'metric-report',
  'incident-report',
  'meeting-minutes',
  'review-record',
  'sign-off',
  'external-attestation',
  'data-flow-diagram',
  'sla',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const RATIONALE_REASONS = [
  'low-coverage',
  'scenario-match',
  'followup-to-claim',
  'contradiction',
  'mandatory-clause',
  'phase-required',
] as const;
export type RationaleReason = (typeof RATIONALE_REASONS)[number];

export const COVERAGE_STATUSES = [
  'untouched',
  'partial',
  'evidenced',
  'contradicted',
  'na',
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const CONFIDENCE_BANDS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export interface AiSystemProfile {
  readonly engagementId: EngagementId;
  readonly firmId: FirmId;
  readonly kinds: readonly AiSystemKind[];
  readonly autonomyLevel: 'advisory' | 'assistive' | 'autonomous';
  readonly dataSensitivity: 'low' | 'medium' | 'high' | 'restricted';
  readonly inScopeClauses: readonly ClauseId[];
  readonly inScopeAnnexControls: readonly string[];
}

export interface InterviewArea {
  readonly areaId: string;
  readonly title: string;
  readonly clauseTags: readonly string[];
}

export interface FollowupPattern {
  readonly id: string;
  readonly trigger:
    | { readonly kind: 'claim-shape'; readonly pattern: string }
    | { readonly kind: 'question-id'; readonly questionId: QuestionLibraryId };
  readonly questionId?: QuestionLibraryId;
  readonly text?: string;
  readonly mappedClauses: readonly string[];
  readonly expectedEvidenceTypes: readonly EvidenceType[];
}

export interface QuestionLibraryEntry {
  readonly id: QuestionLibraryId;
  readonly version: number;
  readonly text: string;
  readonly intent: string;
  readonly mappedClauses: readonly string[];
  readonly applicableKinds: readonly AiSystemKind[];
  readonly applicablePhases: readonly AuditPhase[];
  readonly expectedEvidenceTypes: readonly EvidenceType[];
  readonly commonDeflections: readonly string[];
  readonly followUps: readonly FollowupPattern[];
  readonly tags: readonly string[];
}

export interface QuestionSuggestion {
  readonly id: string;
  readonly sourceLibraryId: QuestionLibraryId;
  readonly libraryVersion: number;
  readonly text: string;
  readonly contextualizedFromLibraryId: QuestionLibraryId | null;
  readonly mappedClauses: readonly string[];
  readonly expectedEvidenceTypes: readonly EvidenceType[];
  readonly commonDeflections: readonly string[];
  readonly followUpQuestionIds: readonly QuestionLibraryId[];
  readonly rationale: readonly RationaleReason[];
  readonly modelInvocationId: ModelInvocationId | null;
}

export interface ExtractedClaim {
  readonly id: ClaimId;
  readonly episodeId: EpisodeId;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly text: string;
  readonly extractedAt: string;
  readonly modelInvocationId: ModelInvocationId | null;
}

export interface RetrievalCandidate {
  readonly clauseId: ClauseId;
  readonly score: number;
  readonly source: 'bm25' | 'pgvector' | 'graph';
}

export interface AttributionResult {
  readonly claimId: ClaimId;
  readonly clauseId: ClauseId;
  readonly confidence: number;
  readonly band: ConfidenceBand;
  readonly rationale: string;
  readonly modelInvocationId: ModelInvocationId | null;
}

export interface ContradictionRecord {
  readonly claimId: ClaimId;
  readonly contradictsClaimId: ClaimId;
  readonly subject: string;
  readonly predicate: string;
  readonly note: string;
}

export interface CoverageDelta {
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly fromStatus: CoverageStatus;
  readonly toStatus: CoverageStatus;
  readonly confidenceDelta: number;
  readonly claimId: ClaimId | null;
  readonly reason: string;
  readonly at: string;
}

export interface CoverageState {
  readonly firmId: FirmId;
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly status: CoverageStatus;
  readonly confidence: number;
  readonly lastUpdate: string;
  readonly lastClaimIds: readonly ClaimId[];
}

export interface CoverageHistoryEntry {
  readonly engagementId: EngagementId;
  readonly clauseId: ClauseId;
  readonly fromStatus: CoverageStatus;
  readonly toStatus: CoverageStatus;
  readonly at: string;
  readonly reason: string;
  readonly claimId: ClaimId | null;
}

export interface AreaCoveredEvent {
  readonly engagementId: EngagementId;
  readonly areaId: string;
  readonly clauseIds: readonly ClauseId[];
  readonly at: string;
}

export interface AttributionReviewCard {
  readonly claim: ExtractedClaim;
  readonly attributions: readonly AttributionResult[];
  readonly contradictions: readonly ContradictionRecord[];
}

export interface AttributionReviewBundle {
  readonly engagementId: EngagementId;
  readonly episodeId: EpisodeId;
  readonly cards: readonly AttributionReviewCard[];
  readonly notCovered: readonly ClauseId[];
  readonly droppedHallucinations: readonly string[];
}

export interface WorkingPaperLink {
  readonly workingPaperId: WorkingPaperId;
  readonly clauseId: ClauseId;
  readonly claimId: ClaimId;
}

export const ConfidenceBandThresholds = {
  HIGH: 0.85,
  MEDIUM: 0.6,
} as const;

export function classifyConfidence(c: number): ConfidenceBand {
  if (c > ConfidenceBandThresholds.HIGH) return 'HIGH';
  if (c >= ConfidenceBandThresholds.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

const ZAiKind = z.enum(AI_SYSTEM_KINDS);
const ZPhase = z.enum(AUDIT_PHASES);
const ZEvidence = z.enum(EVIDENCE_TYPES);

export const QuestionLibraryEntrySchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().nonnegative(),
    text: z.string().min(1),
    intent: z.string().min(1),
    mappedClauses: z.array(z.string().min(1)).min(1),
    applicableKinds: z.array(ZAiKind),
    applicablePhases: z.array(ZPhase).min(1),
    expectedEvidenceTypes: z.array(ZEvidence),
    commonDeflections: z.array(z.string().min(1)),
    followUps: z.array(
      z.object({
        id: z.string().min(1),
        trigger: z.union([
          z.object({
            kind: z.literal('claim-shape'),
            pattern: z.string().min(1),
          }),
          z.object({
            kind: z.literal('question-id'),
            questionId: z.string().min(1),
          }),
        ]),
        questionId: z.string().min(1).optional(),
        text: z.string().min(1).optional(),
        mappedClauses: z.array(z.string().min(1)),
        expectedEvidenceTypes: z.array(ZEvidence),
      }),
    ),
    tags: z.array(z.string().min(1)),
  })
  .strict();

export const QuestionLibrarySchema = z.array(QuestionLibraryEntrySchema);
export type QuestionLibraryFile = z.infer<typeof QuestionLibrarySchema>;
