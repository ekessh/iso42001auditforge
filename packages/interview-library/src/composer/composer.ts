// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import type { InterviewLibraryEntry } from '../domain/entry.js';
import type {
  ComposeOptions,
  InterviewPlan,
  InterviewPlanItem,
} from '../domain/plan.js';
import { InterviewLibraryLoader } from '../loader/loader.js';

function clauseFocusScore(
  e: InterviewLibraryEntry,
  focus: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const c of e.clauseRefs) {
    total += focus[c] ?? 0;
  }
  return total;
}

function modeMatchScore(e: InterviewLibraryEntry, mode: ComposeOptions['mode']): number {
  // 'both' counts as a hit for either; otherwise must match exactly.
  return e.applicableModes.includes(mode) || e.applicableModes.includes('both') ? 1 : 0;
}

/**
 * InterviewComposer builds a deterministic time-boxed interview plan from the
 * library. Ranking combines:
 *
 *   - Auditor focus (explicit per-clause weight)
 *   - Library entry weight
 *   - Clause-coverage marginal gain (selecting an item that covers a still-
 *     uncovered clause is preferred over duplicates)
 *
 * The packing strategy is a greedy fit by score-per-minute. Stable on the
 * library's natural order so the same inputs produce the same plan.
 */
export class InterviewComposer {
  constructor(private readonly loader: InterviewLibraryLoader) {}

  compose(opts: ComposeOptions): InterviewPlan {
    if (opts.roles.length === 0) {
      throw new ValidationError('At least one role is required', {});
    }
    if (opts.durationMinutes <= 0) {
      throw new ValidationError('durationMinutes must be > 0', {});
    }

    const candidates = this.loader.filter({
      roles: opts.roles,
      modes: [opts.mode, 'both'],
      ...(opts.clauses.length > 0 ? { clauses: opts.clauses } : {}),
    });

    const items: InterviewPlanItem[] = [];
    const coverage: Record<string, number> = {};
    let used = 0;
    const remaining = [...candidates];

    while (used < opts.durationMinutes && remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const e = remaining[i]!;
        if (used + e.timeBoxMinutes > opts.durationMinutes) continue;
        const newClauses = e.clauseRefs.filter((c) => !(c in coverage)).length;
        const focus = clauseFocusScore(e, opts.clauseFocus);
        const mode = modeMatchScore(e, opts.mode);
        // marginal-gain weighting: 2 * new clause coverage + library weight + focus + mode.
        const raw = 2 * newClauses + e.weight + focus + mode;
        const score = raw / Math.max(1, e.timeBoxMinutes);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      const picked = remaining.splice(bestIdx, 1)[0]!;
      items.push({ entry: picked, score: bestScore });
      used += picked.timeBoxMinutes;
      for (const c of picked.clauseRefs) {
        coverage[c] = (coverage[c] ?? 0) + 1;
      }
    }

    return {
      engagementId: opts.engagementId,
      totalDurationMinutes: used,
      items,
      coverage,
    };
  }
}
