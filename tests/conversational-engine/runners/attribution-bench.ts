// SPDX-License-Identifier: BUSL-1.1
/**
 * attribution-bench.ts
 *
 * Runs an `AttributionAdapter` (Answer Attribution Engine) over the corpus
 * and reports precision@k and recall@k per Annex A control family.
 *
 * Truth set per entry = primary_attributions ∪ supporting_attributions.
 * Dismissed false-positives are NOT in the truth set: an adapter that emits
 * them is penalized.
 */

import {
  annexFamily,
  isAnnexId,
  loadCorpus,
  precision,
  recall,
  type CorpusEntry,
} from './corpus.js';

export interface RankedAttribution {
  readonly framework: string;
  readonly nodeId: string;
  readonly score: number;
}

export interface AttributionAdapter {
  rank(answer: string, entry: CorpusEntry): Promise<readonly RankedAttribution[]>;
}

export interface PerFamilyMetric {
  readonly family: string;
  readonly precisionAt1: number;
  readonly precisionAt3: number;
  readonly precisionAt5: number;
  readonly recallAt1: number;
  readonly recallAt3: number;
  readonly recallAt5: number;
  readonly entries: number;
}

export interface AttributionMetrics {
  readonly precisionAt1: number;
  readonly precisionAt3: number;
  readonly precisionAt5: number;
  readonly recallAt1: number;
  readonly recallAt3: number;
  readonly recallAt5: number;
  readonly perFamily: Readonly<Record<string, PerFamilyMetric>>;
}

/**
 * Deterministic adapter: returns the ground-truth attributions in score order
 * with two synthetic decoy attributions appended. Floor for the bench.
 */
export class DeterministicAttributionAdapter implements AttributionAdapter {
  async rank(_answer: string, entry: CorpusEntry): Promise<readonly RankedAttribution[]> {
    const truth = [
      ...entry.ground_truth.primary_attributions,
      ...entry.ground_truth.supporting_attributions,
    ];
    const ranked = truth
      .map((t) => ({
        framework: t.framework,
        nodeId: t.nodeId,
        score: t.confidence ?? 0.7,
      }))
      .sort((a, b) => b.score - a.score);

    // Decoys: dismissed false positives from the corpus + a synthetic noise id.
    const decoys: RankedAttribution[] = entry.ground_truth.dismissed_false_positives.map(
      (d) => ({ framework: d.framework, nodeId: d.nodeId, score: 0.4 }),
    );
    decoys.push({ framework: 'ISO42001_AnnexA', nodeId: 'A.5.5', score: 0.35 });

    return [...ranked, ...decoys];
  }
}

function topK(ranked: readonly RankedAttribution[], k: number): readonly RankedAttribution[] {
  return ranked.slice(0, k);
}

function key(a: { readonly framework: string; readonly nodeId: string }): string {
  return `${a.framework}::${a.nodeId}`;
}

export async function runAttributionBench(
  adapter: AttributionAdapter = new DeterministicAttributionAdapter(),
): Promise<AttributionMetrics> {
  const corpus = loadCorpus();
  // Aggregate counters
  let tp1 = 0, fp1 = 0, fn1 = 0;
  let tp3 = 0, fp3 = 0, fn3 = 0;
  let tp5 = 0, fp5 = 0, fn5 = 0;
  const perFamily: Record<string, {
    tp1: number; fp1: number; fn1: number;
    tp3: number; fp3: number; fn3: number;
    tp5: number; fp5: number; fn5: number;
    entries: number;
  }> = {};

  for (const entry of corpus.entries) {
    const truth = [
      ...entry.ground_truth.primary_attributions,
      ...entry.ground_truth.supporting_attributions,
    ];
    const truthKeys = new Set(truth.map((a) => key(a)));
    const predicted = await adapter.rank(entry.answer, entry);

    const families = new Set<string>();
    for (const a of truth) {
      if (isAnnexId(a.framework)) families.add(annexFamily(a.nodeId));
    }

    for (const k of [1, 3, 5] as const) {
      const top = topK(predicted, k);
      const topKeys = new Set(top.map((a) => key(a)));
      let etp = 0, efp = 0;
      for (const x of topKeys) {
        if (truthKeys.has(x)) etp++;
        else efp++;
      }
      const efn = [...truthKeys].filter((x) => !topKeys.has(x)).length;
      if (k === 1) { tp1 += etp; fp1 += efp; fn1 += efn; }
      if (k === 3) { tp3 += etp; fp3 += efp; fn3 += efn; }
      if (k === 5) { tp5 += etp; fp5 += efp; fn5 += efn; }

      for (const fam of families) {
        const f = perFamily[fam] ?? {
          tp1: 0, fp1: 0, fn1: 0,
          tp3: 0, fp3: 0, fn3: 0,
          tp5: 0, fp5: 0, fn5: 0,
          entries: 0,
        };
        if (k === 1) {
          // Family-scoped tp/fp/fn: only count attributions whose family matches.
          const famTrueKeys = new Set(
            truth.filter((a) => isAnnexId(a.framework) && annexFamily(a.nodeId) === fam).map(key),
          );
          const famTopKeys = new Set([...topKeys].filter((kx) => kx.includes(`::${fam}.`) || kx.endsWith(`::${fam}`)));
          for (const x of famTopKeys) {
            if (famTrueKeys.has(x)) f.tp1++;
            else f.fp1++;
          }
          for (const x of famTrueKeys) if (!famTopKeys.has(x)) f.fn1++;
          f.entries++;
        } else if (k === 3) {
          const famTrueKeys = new Set(
            truth.filter((a) => isAnnexId(a.framework) && annexFamily(a.nodeId) === fam).map(key),
          );
          const famTopKeys = new Set([...topKeys].filter((kx) => kx.includes(`::${fam}.`) || kx.endsWith(`::${fam}`)));
          for (const x of famTopKeys) {
            if (famTrueKeys.has(x)) f.tp3++;
            else f.fp3++;
          }
          for (const x of famTrueKeys) if (!famTopKeys.has(x)) f.fn3++;
        } else if (k === 5) {
          const famTrueKeys = new Set(
            truth.filter((a) => isAnnexId(a.framework) && annexFamily(a.nodeId) === fam).map(key),
          );
          const famTopKeys = new Set([...topKeys].filter((kx) => kx.includes(`::${fam}.`) || kx.endsWith(`::${fam}`)));
          for (const x of famTopKeys) {
            if (famTrueKeys.has(x)) f.tp5++;
            else f.fp5++;
          }
          for (const x of famTrueKeys) if (!famTopKeys.has(x)) f.fn5++;
        }
        perFamily[fam] = f;
      }
    }
  }

  const perFamilyOut: Record<string, PerFamilyMetric> = {};
  for (const [fam, x] of Object.entries(perFamily)) {
    perFamilyOut[fam] = {
      family: fam,
      precisionAt1: precision(x.tp1, x.fp1),
      precisionAt3: precision(x.tp3, x.fp3),
      precisionAt5: precision(x.tp5, x.fp5),
      recallAt1: recall(x.tp1, x.fn1),
      recallAt3: recall(x.tp3, x.fn3),
      recallAt5: recall(x.tp5, x.fn5),
      entries: x.entries,
    };
  }

  return {
    precisionAt1: precision(tp1, fp1),
    precisionAt3: precision(tp3, fp3),
    precisionAt5: precision(tp5, fp5),
    recallAt1: recall(tp1, fn1),
    recallAt3: recall(tp3, fn3),
    recallAt5: recall(tp5, fn5),
    perFamily: perFamilyOut,
  };
}

export async function main(): Promise<void> {
  const m = await runAttributionBench();
  console.log(JSON.stringify({ bench: 'attribution', metrics: m }, null, 2));
}

const __isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('attribution-bench.ts') === true;
if (__isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
