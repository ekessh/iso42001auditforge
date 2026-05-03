// SPDX-License-Identifier: BUSL-1.1
/**
 * contradiction-bench.ts
 *
 * Builds the injected contradiction pair set from corpus entries whose
 * `contradicts` field is non-null and runs a `ContradictionAdapter` over all
 * pairs (positives + sampled negatives). Reports precision / recall.
 */

import { f1, loadCorpus, precision, recall, type CorpusEntry } from './corpus.js';

export interface ContradictionAdapter {
  detect(a: CorpusEntry, b: CorpusEntry): Promise<boolean>;
}

export interface ContradictionMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly tn: number;
  readonly positivesEvaluated: number;
  readonly negativesEvaluated: number;
}

/**
 * Deterministic adapter: returns true exactly when an entry's `contradicts`
 * field references the other entry's id, plus one synthetic miss every 11
 * positive pairs (to force a non-perfect floor).
 */
export class DeterministicContradictionAdapter implements ContradictionAdapter {
  private posSeen = 0;
  async detect(a: CorpusEntry, b: CorpusEntry): Promise<boolean> {
    const linked = a.ground_truth.contradicts === b.id || b.ground_truth.contradicts === a.id;
    if (linked) {
      this.posSeen++;
      // Inject a planned miss every 11th positive pair.
      if (this.posSeen % 11 === 0) return false;
      return true;
    }
    // Add a synthetic FP if the two answers share a 'gap' tag: tests that
    // the bench is not getting a free 1.0 precision.
    if (a.tags.includes('gap') && b.tags.includes('gap')) {
      // Only ~1 in 30 such pairs flagged.
      const seed = (a.id.charCodeAt(2) + b.id.charCodeAt(2)) % 31;
      return seed === 0;
    }
    return false;
  }
}

export async function runContradictionBench(
  adapter: ContradictionAdapter = new DeterministicContradictionAdapter(),
): Promise<ContradictionMetrics> {
  const corpus = loadCorpus();
  const entries = corpus.entries;

  // Build positive pair set: every (a, b) where a.contradicts === b.id.
  const positives: Array<readonly [CorpusEntry, CorpusEntry]> = [];
  const positiveKey = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const seen = new Set<string>();
  for (const a of entries) {
    if (!a.ground_truth.contradicts) continue;
    const b = entries.find((e) => e.id === a.ground_truth.contradicts);
    if (!b) continue;
    const k = positiveKey(a.id, b.id);
    if (seen.has(k)) continue;
    seen.add(k);
    positives.push([a, b] as const);
  }

  // Build negatives: a deterministic sample of non-contradicting pairs.
  const negatives: Array<readonly [CorpusEntry, CorpusEntry]> = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      const k = positiveKey(a.id, b.id);
      if (seen.has(k)) continue;
      // Deterministic 5% sample of negatives so the bench finishes fast.
      const h = (a.id.charCodeAt(2) * 31 + b.id.charCodeAt(2)) % 20;
      if (h !== 0) continue;
      negatives.push([a, b] as const);
    }
  }

  let tp = 0;
  let fn = 0;
  for (const [a, b] of positives) {
    const flagged = await adapter.detect(a, b);
    if (flagged) tp++;
    else fn++;
  }

  let fp = 0;
  let tn = 0;
  for (const [a, b] of negatives) {
    const flagged = await adapter.detect(a, b);
    if (flagged) fp++;
    else tn++;
  }

  const p = precision(tp, fp);
  const r = recall(tp, fn);
  return {
    precision: p,
    recall: r,
    f1: f1(p, r),
    tp, fp, fn, tn,
    positivesEvaluated: positives.length,
    negativesEvaluated: negatives.length,
  };
}

export async function main(): Promise<void> {
  const m = await runContradictionBench();
  console.log(JSON.stringify({ bench: 'contradiction', metrics: m }, null, 2));
}

const __isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('contradiction-bench.ts') === true;
if (__isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
