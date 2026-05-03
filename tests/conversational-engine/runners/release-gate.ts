// SPDX-License-Identifier: BUSL-1.1
/**
 * release-gate.ts
 *
 * Runs all three benches and compares each headline metric against
 * `baseline.json`. Fails (exit 1) if any metric regresses by more than
 * `MAX_REGRESSION` (default 5%) — per v3 Section 18.4 and 14.
 *
 * Usage:
 *   tsx runners/release-gate.ts                   # gate
 *   tsx runners/release-gate.ts --update-baseline # write current scores
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { runAttributionBench, type AttributionMetrics } from './attribution-bench.js';
import { runContradictionBench, type ContradictionMetrics } from './contradiction-bench.js';
import { runExtractionBench, type ExtractionMetrics } from './extraction-bench.js';
import { baselinePath } from './corpus.js';

const MAX_REGRESSION = 0.05;

export interface BaselineFile {
  readonly version: string;
  readonly extraction: { precision: number; recall: number; f1: number };
  readonly attribution: {
    precisionAt1: number; precisionAt3: number; precisionAt5: number;
    recallAt1: number; recallAt3: number; recallAt5: number;
  };
  readonly contradiction: { precision: number; recall: number; f1: number };
}

export interface ReleaseGateReport {
  readonly status: 'pass' | 'fail';
  readonly extraction: ExtractionMetrics;
  readonly attribution: AttributionMetrics;
  readonly contradiction: ContradictionMetrics;
  readonly regressions: readonly { metric: string; baseline: number; current: number; delta: number }[];
}

export function loadBaseline(): BaselineFile {
  const raw = readFileSync(baselinePath(), 'utf8');
  return JSON.parse(raw) as BaselineFile;
}

export function compareAgainstBaseline(
  baseline: BaselineFile,
  extraction: ExtractionMetrics,
  attribution: AttributionMetrics,
  contradiction: ContradictionMetrics,
): readonly { metric: string; baseline: number; current: number; delta: number }[] {
  const checks: Array<{ metric: string; baseline: number; current: number }> = [
    { metric: 'extraction.precision', baseline: baseline.extraction.precision, current: extraction.precision },
    { metric: 'extraction.recall', baseline: baseline.extraction.recall, current: extraction.recall },
    { metric: 'extraction.f1', baseline: baseline.extraction.f1, current: extraction.f1 },
    { metric: 'attribution.precisionAt1', baseline: baseline.attribution.precisionAt1, current: attribution.precisionAt1 },
    { metric: 'attribution.precisionAt3', baseline: baseline.attribution.precisionAt3, current: attribution.precisionAt3 },
    { metric: 'attribution.precisionAt5', baseline: baseline.attribution.precisionAt5, current: attribution.precisionAt5 },
    { metric: 'attribution.recallAt1', baseline: baseline.attribution.recallAt1, current: attribution.recallAt1 },
    { metric: 'attribution.recallAt3', baseline: baseline.attribution.recallAt3, current: attribution.recallAt3 },
    { metric: 'attribution.recallAt5', baseline: baseline.attribution.recallAt5, current: attribution.recallAt5 },
    { metric: 'contradiction.precision', baseline: baseline.contradiction.precision, current: contradiction.precision },
    { metric: 'contradiction.recall', baseline: baseline.contradiction.recall, current: contradiction.recall },
    { metric: 'contradiction.f1', baseline: baseline.contradiction.f1, current: contradiction.f1 },
  ];
  const regressions: Array<{ metric: string; baseline: number; current: number; delta: number }> = [];
  for (const c of checks) {
    const delta = c.current - c.baseline;
    if (delta < -MAX_REGRESSION) {
      regressions.push({ ...c, delta });
    }
  }
  return regressions;
}

export async function runReleaseGate(): Promise<ReleaseGateReport> {
  const [extraction, attribution, contradiction] = await Promise.all([
    runExtractionBench(),
    runAttributionBench(),
    runContradictionBench(),
  ]);
  const baseline = loadBaseline();
  const regressions = compareAgainstBaseline(baseline, extraction, attribution, contradiction);
  return {
    status: regressions.length === 0 ? 'pass' : 'fail',
    extraction,
    attribution,
    contradiction,
    regressions,
  };
}

export async function writeBaseline(): Promise<BaselineFile> {
  const [extraction, attribution, contradiction] = await Promise.all([
    runExtractionBench(),
    runAttributionBench(),
    runContradictionBench(),
  ]);
  const baseline: BaselineFile = {
    version: '0.1.0',
    extraction: {
      precision: extraction.precision,
      recall: extraction.recall,
      f1: extraction.f1,
    },
    attribution: {
      precisionAt1: attribution.precisionAt1,
      precisionAt3: attribution.precisionAt3,
      precisionAt5: attribution.precisionAt5,
      recallAt1: attribution.recallAt1,
      recallAt3: attribution.recallAt3,
      recallAt5: attribution.recallAt5,
    },
    contradiction: {
      precision: contradiction.precision,
      recall: contradiction.recall,
      f1: contradiction.f1,
    },
  };
  writeFileSync(baselinePath(), JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  return baseline;
}

export async function main(): Promise<void> {
  if (process.argv.includes('--update-baseline')) {
    const b = await writeBaseline();
    console.log(JSON.stringify({ updatedBaseline: b }, null, 2));
    return;
  }
  const report = await runReleaseGate();
  console.log(
    JSON.stringify(
      {
        status: report.status,
        regressions: report.regressions,
        extraction: { precision: report.extraction.precision, recall: report.extraction.recall, f1: report.extraction.f1 },
        attribution: {
          precisionAt1: report.attribution.precisionAt1,
          precisionAt3: report.attribution.precisionAt3,
          precisionAt5: report.attribution.precisionAt5,
          recallAt1: report.attribution.recallAt1,
          recallAt3: report.attribution.recallAt3,
          recallAt5: report.attribution.recallAt5,
        },
        contradiction: {
          precision: report.contradiction.precision,
          recall: report.contradiction.recall,
          f1: report.contradiction.f1,
        },
      },
      null,
      2,
    ),
  );
  if (report.status === 'fail') {
    process.exit(1);
  }
}

const __isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('release-gate.ts') === true;
if (__isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
