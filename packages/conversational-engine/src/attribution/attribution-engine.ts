// SPDX-License-Identifier: BUSL-1.1
import type {
  AttributionResult,
  AttributionReviewBundle,
  AttributionReviewCard,
  ContradictionRecord,
  CoverageDelta,
  CoverageState,
  ExtractedClaim,
  WorkingPaperLink,
} from '../types/domain.js';
import { classifyConfidence } from '../types/domain.js';
import type {
  ClaimId,
  ClauseId,
  EngagementId,
  EpisodeId,
  ModelInvocationId,
} from '../types/ids.js';
import type {
  ClaimExtractor,
  ClaimGraphReader,
  ClauseCatalog,
  EpisodeStore,
  HybridRetrievalService,
  RawAnswer,
  ReRanker,
  WorkingPaperLinker,
} from '../types/memory-shim.js';

export interface AttributionEngineDeps {
  readonly episodeStore: EpisodeStore;
  readonly extractor: ClaimExtractor;
  readonly retrieval: HybridRetrievalService;
  readonly reranker: ReRanker;
  readonly clauseCatalog: ClauseCatalog;
  readonly graphReader: ClaimGraphReader;
  readonly workingPaperLinker?: WorkingPaperLinker;
  readonly logger?: AttributionLogger;
}

export interface AttributionLogger {
  warn(event: string, details: Record<string, unknown>): void;
  info(event: string, details: Record<string, unknown>): void;
}

export interface AttributeAnswerInput {
  readonly answer: RawAnswer;
  readonly priorCoverage: ReadonlyMap<string, CoverageState>;
  readonly questionTargetedClauses: readonly ClauseId[];
  readonly retrievalLimit?: number;
}

export interface AttributeAnswerResult {
  readonly bundle: AttributionReviewBundle;
  readonly deltas: readonly CoverageDelta[];
  readonly workingPaperLinks: readonly WorkingPaperLink[];
}

const DEFAULT_RETRIEVAL_LIMIT = 8;

export class AnswerAttributionEngine {
  constructor(private readonly deps: AttributionEngineDeps) {}

  async attribute(input: AttributeAnswerInput): Promise<AttributeAnswerResult> {
    // Step 1 — Episode write
    const episodeId: EpisodeId = await this.deps.episodeStore.write(input.answer);

    // Step 2 — Claim extraction
    const { claims } = await this.deps.extractor.extract({
      episodeId,
      text: input.answer.auditeeText,
    });

    // Steps 3 + 4 + 5 per claim
    const cards: AttributionReviewCard[] = [];
    const allDeltas: CoverageDelta[] = [];
    const allLinks: WorkingPaperLink[] = [];
    const droppedHallucinations: string[] = [];
    const evidencedClauses = new Set<string>();

    for (const claim of claims) {
      const candidates = await this.deps.retrieval.retrieve({
        claim,
        limit: input.retrievalLimit ?? DEFAULT_RETRIEVAL_LIMIT,
      });

      const { judgments, modelInvocationId } = await this.deps.reranker.rank({
        claim,
        candidates,
      });

      const valid: AttributionResult[] = [];
      for (const j of judgments) {
        if (!this.deps.clauseCatalog.has(j.clauseId as unknown as ClauseId)) {
          droppedHallucinations.push(j.clauseId);
          this.deps.logger?.warn('attribution.hallucinated_clause_dropped', {
            claimId: claim.id,
            clauseId: j.clauseId,
            invocation: modelInvocationId,
          });
          continue;
        }
        valid.push({
          claimId: claim.id,
          clauseId: j.clauseId as unknown as ClauseId,
          confidence: j.confidence,
          band: classifyConfidence(j.confidence),
          rationale: j.rationale,
          modelInvocationId,
        });
      }

      const contradictions: readonly ContradictionRecord[] =
        await this.deps.graphReader.findContradictions({
          engagementId: input.answer.engagementId as EngagementId,
          claim,
        });

      cards.push({ claim, attributions: valid, contradictions });

      // Step 6 — Coverage deltas
      for (const a of valid) {
        const prior = input.priorCoverage.get(a.clauseId as unknown as string);
        const fromStatus = prior?.status ?? 'untouched';
        const toStatus =
          contradictions.length > 0
            ? 'contradicted'
            : a.band === 'HIGH'
              ? 'evidenced'
              : a.band === 'MEDIUM'
                ? 'partial'
                : fromStatus;
        if (toStatus === fromStatus) continue;
        const delta: CoverageDelta = {
          engagementId: input.answer.engagementId as EngagementId,
          clauseId: a.clauseId,
          fromStatus,
          toStatus,
          confidenceDelta: a.confidence,
          claimId: claim.id,
          reason: a.rationale,
          at: input.answer.capturedAt,
        };
        allDeltas.push(delta);
        if (toStatus === 'evidenced') {
          evidencedClauses.add(a.clauseId as unknown as string);
        }
      }

      // Step 8 — Working paper linkage (HIGH band only is auto-linked here)
      if (this.deps.workingPaperLinker) {
        for (const a of valid) {
          if (a.band !== 'HIGH') continue;
          const result = await this.deps.workingPaperLinker.link({
            engagementId: input.answer.engagementId as EngagementId,
            clauseId: a.clauseId,
            claimId: claim.id as ClaimId,
            episodeId,
          });
          allLinks.push({
            workingPaperId: result.workingPaperId as never,
            clauseId: a.clauseId,
            claimId: claim.id as ClaimId,
          });
        }
      }
    }

    // "What didn't get covered" panel
    const notCovered = input.questionTargetedClauses.filter(
      (c) => !evidencedClauses.has(c as unknown as string),
    );

    // Step 7 — Auditor review bundle
    const bundle: AttributionReviewBundle = {
      engagementId: input.answer.engagementId as EngagementId,
      episodeId,
      cards,
      notCovered,
      droppedHallucinations,
    };

    return { bundle, deltas: allDeltas, workingPaperLinks: allLinks };
  }
}

export type {
  AttributionResult,
  ExtractedClaim,
  ModelInvocationId,
};
