// SPDX-License-Identifier: BUSL-1.1
import type {
  AiSystemProfile,
  CoverageState,
  ExtractedClaim,
  InterviewArea,
  RetrievalCandidate,
} from '../src/types/domain.js';
import {
  asClaimId,
  asClauseId,
  asEpisodeId,
  asModelInvocationId,
  type EngagementId,
  type FirmId,
} from '../src/types/ids.js';
import type { ClauseId } from '../src/types/ids.js';
import type {
  ClaimExtractor,
  ClaimGraphReader,
  ClauseCatalog,
  EpisodeStore,
  HybridRetrievalService,
  RawAnswer,
  ReRanker,
  WorkingPaperLinker,
} from '../src/types/memory-shim.js';

export const FIRM = '00000000-0000-4000-8000-000000000001' as FirmId;
export const ENGAGEMENT = '00000000-0000-4000-8000-0000000000aa' as EngagementId;

export function makeProfile(): AiSystemProfile {
  return {
    engagementId: ENGAGEMENT,
    firmId: FIRM,
    kinds: ['llm', 'rag'],
    autonomyLevel: 'assistive',
    dataSensitivity: 'high',
    inScopeClauses: ['4.3', '5.2', '6.1.2', '6.1.4', '8.1', '9.1', 'A.6.2.5'].map(asClauseId),
    inScopeAnnexControls: ['A.6.2.5', 'A.7.4', 'A.9.4'],
  };
}

export function makeArea(clauseTags: readonly string[] = ['6.1.2', '6.1.4']): InterviewArea {
  return {
    areaId: 'area-risk',
    title: 'AI Risk Management',
    clauseTags,
  };
}

export function makeAnswer(text: string, capturedAt = '2026-05-03T10:00:00Z'): RawAnswer {
  return {
    engagementId: ENGAGEMENT,
    questionInvocationId: 'qi-test-1',
    auditeeText: text,
    attachedEvidenceIds: [],
    capturedAt,
  };
}

export function makeClauseCatalog(ids: readonly string[]): ClauseCatalog {
  const set = new Set(ids);
  return {
    has: (c) => set.has(c as unknown as string),
    list: () => ids.map(asClauseId),
    textFor: (c) => `Clause text for ${c as unknown as string}`,
  };
}

export class FakeEpisodeStore implements EpisodeStore {
  public lastWritten: RawAnswer | undefined;
  public counter = 0;
  async write(a: RawAnswer) {
    this.lastWritten = a;
    this.counter += 1;
    return asEpisodeId(`ep-${this.counter}`);
  }
}

export class FakeClaimExtractor implements ClaimExtractor {
  constructor(private readonly claims: readonly Omit<ExtractedClaim, 'episodeId' | 'extractedAt' | 'modelInvocationId'>[]) {}
  async extract(input: { episodeId: ReturnType<typeof asEpisodeId>; text: string }) {
    const inv = asModelInvocationId('mi-extractor-1');
    return {
      claims: this.claims.map((c) => ({
        ...c,
        episodeId: input.episodeId,
        extractedAt: '2026-05-03T10:00:01Z',
        modelInvocationId: inv,
      })) as readonly ExtractedClaim[],
      modelInvocationId: inv,
    };
  }
}

export class FakeRetrieval implements HybridRetrievalService {
  constructor(private readonly results: readonly RetrievalCandidate[]) {}
  async retrieve() {
    return this.results;
  }
}

export class FakeReRanker implements ReRanker {
  constructor(
    private readonly judgments: readonly { clauseId: string; confidence: number; rationale: string }[],
  ) {}
  async rank() {
    return {
      judgments: this.judgments,
      modelInvocationId: asModelInvocationId('mi-rerank-1'),
    };
  }
}

export class FakeGraphReader implements ClaimGraphReader {
  constructor(private readonly hits: readonly { subject: string; predicate: string; contradictsClaimId: string }[] = []) {}
  async findContradictions(input: { engagementId: EngagementId; claim: ExtractedClaim }) {
    return this.hits
      .filter((h) => h.subject === input.claim.subject && h.predicate === input.claim.predicate)
      .map((h) => ({
        claimId: input.claim.id,
        contradictsClaimId: asClaimId(h.contradictsClaimId),
        subject: h.subject,
        predicate: h.predicate,
        note: 'fake-contradiction',
      }));
  }
}

export class FakeWorkingPaperLinker implements WorkingPaperLinker {
  public calls = 0;
  async link(input: { clauseId: ClauseId; claimId: ReturnType<typeof asClaimId> }) {
    this.calls += 1;
    return { workingPaperId: `wp-${input.clauseId as unknown as string}-${this.calls}` };
  }
}

export function buildClaim(
  id: string,
  text: string,
  predicate = 'has',
  subject = 'org',
  object = 'process',
): Omit<ExtractedClaim, 'episodeId' | 'extractedAt' | 'modelInvocationId'> {
  return {
    id: asClaimId(id),
    subject,
    predicate,
    object,
    text,
  };
}

export function emptyCoverage(): ReadonlyMap<string, CoverageState> {
  return new Map();
}
