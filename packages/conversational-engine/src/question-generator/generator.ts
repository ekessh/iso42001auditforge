// SPDX-License-Identifier: BUSL-1.1
import type { QuestionLibraryLoader } from '../question-library/loader.js';
import type {
  AiSystemProfile,
  AuditPhase,
  CoverageState,
  InterviewArea,
  QuestionLibraryEntry,
  QuestionSuggestion,
  RationaleReason,
} from '../types/domain.js';
import type { QuestionLibraryId } from '../types/ids.js';
import type { QuestionContextualizer } from '../types/memory-shim.js';
import { prioritize } from './prioritizer.js';
import { resolveScope } from './scope-resolver.js';

export interface AskedAnsweredPredicate {
  isAlreadyAsked(libraryId: QuestionLibraryId): boolean;
  isAlreadyAnswered(libraryId: QuestionLibraryId): boolean;
}

export interface QuestionGeneratorDeps {
  readonly library: QuestionLibraryLoader;
  readonly contextualizer?: QuestionContextualizer;
  readonly mandatoryClauses?: ReadonlySet<string>;
  readonly phaseRequiredClauses?: (phase: AuditPhase) => ReadonlySet<string>;
  readonly idFactory?: () => string;
}

export interface GenerateInput {
  readonly profile: AiSystemProfile;
  readonly phase: AuditPhase;
  readonly area: InterviewArea;
  readonly coverage: ReadonlyMap<string, CoverageState>;
  readonly predicate: AskedAnsweredPredicate;
  readonly engagementContext: string;
  readonly limit?: number;
  readonly contextualizeTopN?: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_CONTEXTUALIZE_TOP_N = 0;
const DEFAULT_MANDATORY_CLAUSES: readonly string[] = [
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3',
  '6.1.2', '6.1.3', '6.1.4', '6.2',
  '7.2', '7.3', '7.5',
  '8.1', '8.2', '8.3', '8.4',
  '9.1', '9.2', '9.3',
  '10.1', '10.2',
];

const DEFAULT_PHASE_REQUIRED: Readonly<Record<AuditPhase, readonly string[]>> = {
  S1: ['4.1', '4.2', '4.3', '5.2', '6.2'],
  S2: ['8.1', '8.3', '8.4', '9.1', '9.3', '10.2'],
  Surv: ['9.1', '9.3', '10.2'],
  Recert: ['4.1', '5.1', '5.2', '6.1.2', '8.1', '8.3', '9.3', '10.2'],
  Special: ['10.2'],
  Readiness: ['4.3', '5.2', '6.1.2', '6.2', '8.1', '8.3', '9.1', '9.3', '10.2'],
};

export class QuestionGenerator {
  constructor(private readonly deps: QuestionGeneratorDeps) {}

  async generate(input: GenerateInput): Promise<readonly QuestionSuggestion[]> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const topN = input.contextualizeTopN ?? DEFAULT_CONTEXTUALIZE_TOP_N;

    // (a) Scope resolution
    const scope = resolveScope({
      profile: input.profile,
      phase: input.phase,
      area: input.area,
    });

    // (b) Library retrieval — match on kinds, phases, and either clauses or tags
    const candidates = this.deps.library.find({
      kinds: scope.kinds,
      phases: scope.phases,
    });
    const filteredByClause = filterByClauseOrTag(candidates, scope);
    const usable = filteredByClause.filter(
      (e) =>
        !input.predicate.isAlreadyAsked(e.id) &&
        !input.predicate.isAlreadyAnswered(e.id),
    );

    // (c) Coverage prioritisation
    const mandatory = this.deps.mandatoryClauses ?? new Set(DEFAULT_MANDATORY_CLAUSES);
    const phaseRequired = this.deps.phaseRequiredClauses
      ? this.deps.phaseRequiredClauses(input.phase)
      : new Set(DEFAULT_PHASE_REQUIRED[input.phase] ?? []);
    const ranked = prioritize({
      entries: usable,
      coverage: input.coverage,
      mandatoryClauses: mandatory,
      currentPhaseRequiredClauses: phaseRequired,
    });
    const top = ranked.slice(0, limit);

    // (d) Contextualisation (LLM, optional, never invents)
    const contextualised = await this.applyContextualization(
      top,
      topN,
      input.engagementContext,
    );

    // (e) Follow-up assembly
    return contextualised.map((c) => this.toSuggestion(c));
  }

  private async applyContextualization(
    ranked: readonly { entry: QuestionLibraryEntry; rationale: readonly RationaleReason[] }[],
    topN: number,
    engagementContext: string,
  ): Promise<
    readonly {
      entry: QuestionLibraryEntry;
      rationale: readonly RationaleReason[];
      finalText: string;
      contextualisedFromLibraryId: QuestionLibraryId | null;
      modelInvocationId: string | null;
    }[]
  > {
    const out: {
      entry: QuestionLibraryEntry;
      rationale: readonly RationaleReason[];
      finalText: string;
      contextualisedFromLibraryId: QuestionLibraryId | null;
      modelInvocationId: string | null;
    }[] = [];
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i]!;
      if (i < topN && this.deps.contextualizer) {
        const result = await this.deps.contextualizer.rewrite({
          libraryText: r.entry.text,
          engagementContext,
        });
        out.push({
          entry: r.entry,
          rationale: r.rationale,
          finalText: result.text,
          contextualisedFromLibraryId: r.entry.id,
          modelInvocationId: result.modelInvocationId as unknown as string | null,
        });
      } else {
        out.push({
          entry: r.entry,
          rationale: r.rationale,
          finalText: r.entry.text,
          contextualisedFromLibraryId: null,
          modelInvocationId: null,
        });
      }
    }
    return out;
  }

  private toSuggestion(c: {
    entry: QuestionLibraryEntry;
    rationale: readonly RationaleReason[];
    finalText: string;
    contextualisedFromLibraryId: QuestionLibraryId | null;
    modelInvocationId: string | null;
  }): QuestionSuggestion {
    const followUpQuestionIds: QuestionLibraryId[] = [];
    for (const fu of c.entry.followUps) {
      if (fu.questionId) followUpQuestionIds.push(fu.questionId);
      if (fu.trigger.kind === 'question-id') {
        followUpQuestionIds.push(fu.trigger.questionId);
      }
    }
    const id = (this.deps.idFactory ?? defaultId)();
    return {
      id,
      sourceLibraryId: c.entry.id,
      libraryVersion: c.entry.version,
      text: c.finalText,
      contextualizedFromLibraryId: c.contextualisedFromLibraryId,
      mappedClauses: c.entry.mappedClauses,
      expectedEvidenceTypes: c.entry.expectedEvidenceTypes,
      commonDeflections: c.entry.commonDeflections,
      followUpQuestionIds: dedupe(followUpQuestionIds),
      rationale: c.rationale,
      modelInvocationId: c.modelInvocationId as never,
    };
  }
}

function filterByClauseOrTag(
  entries: readonly QuestionLibraryEntry[],
  scope: { clauses: readonly string[]; tags: readonly string[] },
): readonly QuestionLibraryEntry[] {
  const clauseSet = new Set(scope.clauses);
  const tagSet = new Set(scope.tags);
  return entries.filter((e) => {
    const clauseHit = e.mappedClauses.some((c) => clauseSet.has(c));
    const tagHit = e.tags.some((t) => tagSet.has(t));
    return clauseHit || tagHit;
  });
}

function dedupe<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

let counter = 0;
function defaultId(): string {
  counter += 1;
  return `qsug-${Date.now().toString(36)}-${counter.toString(36)}`;
}
