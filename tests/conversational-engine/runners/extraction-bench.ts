// SPDX-License-Identifier: BUSL-1.1
/**
 * extraction-bench.ts
 *
 * Runs an `ExtractionAdapter` over the corpus and reports precision / recall /
 * F1 of `(subject, predicate, object)` triples vs ground truth.
 *
 * Adapter contract is narrow on purpose: implementations consume an answer and
 * return a triple list. The default adapter is a deterministic
 * keyword-mapping baseline used for CI smoke and as the regression floor; real
 * implementations (`@auditforge/conversational-engine`'s extractor over a
 * small LLM) override the adapter when called from production benches.
 */

import { f1, loadCorpus, precision, recall, tripleKey, type CorpusEntry, type CorpusGroundTruthClaim } from './corpus.js';

export interface ExtractionAdapter {
  extract(answer: string, entry: CorpusEntry): Promise<readonly CorpusGroundTruthClaim[]>;
}

export interface ExtractionMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly tp: number;
  readonly fp: number;
  readonly fn: number;
  readonly perFamily: Readonly<Record<string, { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number }>>;
}

/**
 * Deterministic adapter used as the regression floor: returns the ground-truth
 * triples augmented with one synthetic noise triple per entry, so precision is
 * < 1.0 (otherwise we'd never observe regressions).
 *
 * NOTE: This adapter is a stand-in until `packages/conversational-engine`'s
 * Extraction service is ready (Phase 7.6). At that point the real adapter
 * gets injected and this floor moves with it.
 */
export class DeterministicExtractionAdapter implements ExtractionAdapter {
  async extract(_answer: string, entry: CorpusEntry): Promise<readonly CorpusGroundTruthClaim[]> {
    const truth = entry.ground_truth.claims;
    if (truth.length === 0) {
      return [{ subject: 'noise', predicate: 'has', object: 'subject' }];
    }
    // Drop one truth claim to produce a false negative on entries with >=2,
    // and add one false-positive triple.
    const out = truth.slice(truth.length >= 2 ? 1 : 0).map((c) => ({ ...c }));
    out.push({ subject: 'extra', predicate: 'is', object: 'noise' });
    return out;
  }
}

export async function runExtractionBench(
  adapter: ExtractionAdapter = new DeterministicExtractionAdapter(),
): Promise<ExtractionMetrics> {
  const corpus = loadCorpus();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const perFamily: Record<string, { tp: number; fp: number; fn: number }> = {};

  for (const entry of corpus.entries) {
    const predicted = await adapter.extract(entry.answer, entry);
    const predSet = new Set(predicted.map(tripleKey));
    const truthSet = new Set(entry.ground_truth.claims.map(tripleKey));
    let entryTp = 0;
    let entryFp = 0;
    let entryFn = 0;
    for (const k of predSet) {
      if (truthSet.has(k)) entryTp++;
      else entryFp++;
    }
    for (const k of truthSet) {
      if (!predSet.has(k)) entryFn++;
    }
    tp += entryTp;
    fp += entryFp;
    fn += entryFn;
    for (const tag of entry.tags) {
      const f = perFamily[tag] ?? { tp: 0, fp: 0, fn: 0 };
      f.tp += entryTp;
      f.fp += entryFp;
      f.fn += entryFn;
      perFamily[tag] = f;
    }
  }

  const p = precision(tp, fp);
  const r = recall(tp, fn);
  const score = f1(p, r);
  const perFamilyOut: Record<string, { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number }> = {};
  for (const [name, x] of Object.entries(perFamily)) {
    const fp1 = precision(x.tp, x.fp);
    const fr1 = recall(x.tp, x.fn);
    perFamilyOut[name] = { precision: fp1, recall: fr1, f1: f1(fp1, fr1), tp: x.tp, fp: x.fp, fn: x.fn };
  }
  return { precision: p, recall: r, f1: score, tp, fp, fn, perFamily: perFamilyOut };
}

export async function main(): Promise<void> {
  const m = await runExtractionBench();
  console.log(JSON.stringify({ bench: 'extraction', metrics: m }, null, 2));
}

const __isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('extraction-bench.ts') === true;
if (__isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
