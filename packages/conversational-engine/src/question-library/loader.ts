// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import {
  AI_SYSTEM_KINDS,
  type AiSystemKind,
  type AuditPhase,
  QuestionLibrarySchema,
  type QuestionLibraryEntry,
} from '../types/domain.js';
import {
  asQuestionLibraryId,
  type QuestionLibraryId,
} from '../types/ids.js';
import libraryJson from './library.json' with { type: 'json' };

export interface QuestionLibraryFilter {
  readonly kinds?: readonly AiSystemKind[];
  readonly phases?: readonly AuditPhase[];
  readonly clauses?: readonly string[];
  readonly tags?: readonly string[];
}

function brand(entry: QuestionLibraryEntry): QuestionLibraryEntry {
  // structural type already matches; cast through unknown to apply id brand
  return {
    ...entry,
    id: asQuestionLibraryId(entry.id as unknown as string),
    followUps: entry.followUps.map((fu) => ({
      ...fu,
      ...(fu.questionId
        ? { questionId: asQuestionLibraryId(fu.questionId as unknown as string) }
        : {}),
      trigger:
        fu.trigger.kind === 'question-id'
          ? {
              kind: 'question-id' as const,
              questionId: asQuestionLibraryId(
                fu.trigger.questionId as unknown as string,
              ),
            }
          : fu.trigger,
    })),
  };
}

export class QuestionLibraryLoader {
  private readonly entries: readonly QuestionLibraryEntry[];
  private readonly byId: ReadonlyMap<QuestionLibraryId, QuestionLibraryEntry>;

  private constructor(entries: readonly QuestionLibraryEntry[]) {
    this.entries = entries;
    const map = new Map<QuestionLibraryId, QuestionLibraryEntry>();
    for (const e of entries) map.set(e.id, e);
    this.byId = map;
  }

  static fromJson(input: unknown): QuestionLibraryLoader {
    const parsed = QuestionLibrarySchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('QuestionLibrary failed schema validation', {
        issues: parsed.error.issues,
      });
    }
    const entries = parsed.data.map((e) => {
      // Validate that all applicableKinds are known
      for (const k of e.applicableKinds) {
        if (!AI_SYSTEM_KINDS.includes(k)) {
          throw new ValidationError(`Unknown AI system kind: ${k}`);
        }
      }
      return brand(e as unknown as QuestionLibraryEntry);
    });
    // Detect duplicate IDs
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.id)) throw new ValidationError(`Duplicate question id: ${e.id}`);
      seen.add(e.id);
    }
    // Validate follow-up cross-references
    for (const e of entries) {
      for (const fu of e.followUps) {
        if (fu.questionId && !seen.has(fu.questionId)) {
          throw new ValidationError(
            `Follow-up ${fu.id} references unknown question id: ${fu.questionId}`,
          );
        }
        if (
          fu.trigger.kind === 'question-id' &&
          !seen.has(fu.trigger.questionId)
        ) {
          throw new ValidationError(
            `Follow-up ${fu.id} trigger references unknown question id: ${fu.trigger.questionId}`,
          );
        }
      }
    }
    return new QuestionLibraryLoader(entries);
  }

  static loadDefault(): QuestionLibraryLoader {
    return QuestionLibraryLoader.fromJson(libraryJson);
  }

  count(): number {
    return this.entries.length;
  }

  all(): readonly QuestionLibraryEntry[] {
    return this.entries;
  }

  get(id: QuestionLibraryId): QuestionLibraryEntry | undefined {
    return this.byId.get(id);
  }

  find(filter: QuestionLibraryFilter): readonly QuestionLibraryEntry[] {
    return this.entries.filter((e) => matches(e, filter));
  }

  countFollowUps(): number {
    return this.entries.reduce((sum, e) => sum + e.followUps.length, 0);
  }

  /**
   * Returns follow-up patterns triggered by a claim text.
   * Iterates the library, matching `claim-shape` triggers via case-insensitive RegExp.
   */
  matchClaimShape(claimText: string): ReadonlyArray<{
    readonly question: QuestionLibraryEntry;
    readonly followUpId: string;
    readonly questionId: QuestionLibraryId | undefined;
    readonly text: string | undefined;
    readonly mappedClauses: readonly string[];
  }> {
    const out: Array<{
      question: QuestionLibraryEntry;
      followUpId: string;
      questionId: QuestionLibraryId | undefined;
      text: string | undefined;
      mappedClauses: readonly string[];
    }> = [];
    for (const q of this.entries) {
      for (const fu of q.followUps) {
        if (fu.trigger.kind !== 'claim-shape') continue;
        let re: RegExp;
        try {
          re = new RegExp(fu.trigger.pattern, 'i');
        } catch {
          continue;
        }
        if (re.test(claimText)) {
          out.push({
            question: q,
            followUpId: fu.id,
            questionId: fu.questionId,
            text: fu.text,
            mappedClauses: fu.mappedClauses,
          });
        }
      }
    }
    return out;
  }
}

function matches(
  e: QuestionLibraryEntry,
  filter: QuestionLibraryFilter,
): boolean {
  if (filter.kinds && filter.kinds.length > 0) {
    const hit = filter.kinds.some((k) => e.applicableKinds.includes(k));
    if (!hit) return false;
  }
  if (filter.phases && filter.phases.length > 0) {
    const hit = filter.phases.some((p) => e.applicablePhases.includes(p));
    if (!hit) return false;
  }
  if (filter.clauses && filter.clauses.length > 0) {
    const hit = filter.clauses.some((c) => e.mappedClauses.includes(c));
    if (!hit) return false;
  }
  if (filter.tags && filter.tags.length > 0) {
    const hit = filter.tags.some((t) => e.tags.includes(t));
    if (!hit) return false;
  }
  return true;
}
