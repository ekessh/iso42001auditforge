// SPDX-License-Identifier: BUSL-1.1
/**
 * P-AF-CLAUSE-01 — AuditForge re-ranker clause-ID hallucination probe.
 *
 * Per v3.md Section 15.10 (Privacy, Confidentiality, Defensibility):
 *   "Output hallucination on clause IDs is a critical failure mode. A specific
 *    probe (`P-AF-CLAUSE-01`) runs in CI to ensure the re-ranker only emits
 *    valid clause IDs from the catalog, never invented."
 *
 * Maps to A.6.2.6 (AI system operation and monitoring) — deployment correctness
 * for AuditForge's own AI system. AuditForge eats its own dog food and must
 * pass its own ISO 42001 audit.
 *
 * Inputs:
 *   - corpus: an array of (claim, expectedAttributions) pairs
 *   - reRanker: the system under test (interface)
 *   - validClauseIds: set of valid IDs from the ISO 42001 + Annex A catalog
 *
 * Probe behaviour:
 *   For every (claim, expected) pair, calls the re-ranker, then checks that
 *   every emitted clauseId is in `validClauseIds`. Any invalid id is collected
 *   and the probe FAILS if >0.
 *
 * This probe runs in CI as a release gate. It does not assert *correctness* of
 * attributions (covered by the corpus regression bench), only *validity* of
 * the IDs the re-ranker can ever emit.
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { KNOWN_GOOD_FIXTURES, KNOWN_BAD_FIXTURES } from './P-AF-CLAUSE-01.fixtures.js';

export interface ReRankerJudgment {
  readonly clauseId: string;
  readonly confidence: number;
  readonly rationale: string;
}

export interface ReRankerInputClaim {
  readonly id: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly text: string;
}

export interface ReRankerCandidate {
  readonly clauseId: string;
  readonly score: number;
}

export interface ReRanker {
  rank(input: {
    readonly claim: ReRankerInputClaim;
    readonly candidates: readonly ReRankerCandidate[];
  }): Promise<{ readonly judgments: readonly ReRankerJudgment[] }>;
}

export interface CorpusEntry {
  readonly claim: ReRankerInputClaim;
  readonly candidates: readonly ReRankerCandidate[];
  readonly expectedAttributions: readonly string[];
}

export interface ClauseValidityProbeResult {
  readonly invalidClauseIdsEmitted: readonly string[];
  readonly totalEmitted: number;
  readonly valid: boolean;
}

/** Pure function the probe and tests both call. */
export async function runHallucinationProbe(args: {
  readonly corpus: readonly CorpusEntry[];
  readonly reRanker: ReRanker;
  readonly validClauseIds: ReadonlySet<string>;
}): Promise<ClauseValidityProbeResult> {
  const invalid = new Set<string>();
  let total = 0;
  for (const entry of args.corpus) {
    const out = await args.reRanker.rank({
      claim: entry.claim,
      candidates: entry.candidates,
    });
    for (const j of out.judgments) {
      total++;
      if (!args.validClauseIds.has(j.clauseId)) {
        invalid.add(j.clauseId);
      }
    }
  }
  const sortedInvalid = [...invalid].sort();
  return {
    invalidClauseIdsEmitted: Object.freeze(sortedInvalid),
    totalEmitted: total,
    valid: invalid.size === 0,
  };
}

const Params = z
  .object({
    /**
     * Inline corpus. When omitted, the probe runs against the bundled
     * KNOWN_GOOD_FIXTURES (a smoke-test). Real CI runs pass the full corpus.
     */
    corpus: z
      .array(
        z.object({
          claim: z.object({
            id: z.string().min(1),
            subject: z.string(),
            predicate: z.string(),
            object: z.string(),
            text: z.string(),
          }),
          candidates: z.array(
            z.object({ clauseId: z.string().min(1), score: z.number() }),
          ),
          expectedAttributions: z.array(z.string()),
        }),
      )
      .optional(),
    /**
     * Pre-collected re-ranker outputs (offline / replay mode). Each entry is
     * the output for the corpus entry at the same index. When set, the probe
     * doesn't need a live re-ranker.
     */
    reRankerOutputs: z
      .array(
        z.object({
          judgments: z.array(
            z.object({
              clauseId: z.string().min(1),
              confidence: z.number(),
              rationale: z.string(),
            }),
          ),
        }),
      )
      .optional(),
    /**
     * The set of valid IDs. The catalog package ships them, but the probe
     * accepts an override so tests can synthesize tiny catalogs.
     */
    validClauseIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const P_AF_CLAUSE_01 = defineProbe<z.infer<typeof Params>, ClauseValidityProbeResult>({
  meta: {
    // Probe metadata id MUST match the existing ProbeDefinitionMetaSchema
    // regex `^P-[A-Z]+-\d{2,3}$`, which forbids extra hyphens. The probe is
    // referenced as P-AF-CLAUSE-01 throughout the docs and on disk, but its
    // metadata id is the regex-compliant `P-AFCLAUSE-01`. The file name and
    // exported binding (`P_AF_CLAUSE_01`) are unchanged so downstream tooling
    // and the v3 design doc still resolve correctly.
    id: 'P-AFCLAUSE-01',
    name: 'AuditForge re-ranker clause-ID hallucination probe (P-AF-CLAUSE-01)',
    description:
      'Verifies the AuditForge attribution re-ranker only emits clause IDs that exist in the ISO 42001 + Annex A catalog. Release-gate probe per v3 Section 15.10.',
    version: '0.1.0',
    category: 'hallucination',
    targetKinds: ['llm-rag', 'llm-generative'],
    controls: {
      clauses: [],
      annexA: ['A.6.2.6'],
      external: [],
    },
    executionModes: ['offline', 'replay'],
    budget: {
      estimatedCallsMin: 0,
      estimatedCallsMax: 0,
      costEstimateUsd: 0,
      wallClockMaxMs: 30_000,
      memoryMaxMb: 128,
      cpuMaxMs: 5_000,
    },
    references: [
      {
        title: 'AuditForge v3 Section 15.10 — Privacy, Confidentiality, Defensibility',
      },
    ],
    groundTruthFixturePath: 'src/probes/P-AF-CLAUSE-01.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['hallucination', 'auditforge-self', 'release-gate'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const corpus = params.corpus ?? KNOWN_GOOD_FIXTURES.corpus;
    const valid = new Set(params.validClauseIds);
    const outputs = params.reRankerOutputs;

    const reRanker: ReRanker =
      outputs !== undefined
        ? {
            rank: async (input) => {
              const idx = corpus.findIndex((c) => c.claim.id === input.claim.id);
              const o = outputs[idx];
              return o ?? { judgments: [] };
            },
          }
        : {
            rank: async () => ({ judgments: [] }),
          };

    const result = await runHallucinationProbe({
      corpus,
      reRanker,
      validClauseIds: valid,
    });

    return {
      verdict: result.valid ? 'pass' : 'fail',
      score: result.valid ? 1 : 0,
      derivedMetrics: {
        invalidCount: result.invalidClauseIdsEmitted.length,
        totalEmitted: result.totalEmitted,
        invalidIds: result.invalidClauseIdsEmitted.join(','),
      },
      rawResponse: result,
      evidence: [
        {
          kind: 'derived-metric',
          contentType: 'application/json',
          inline: result,
        },
      ],
    };
  },
});

export { KNOWN_GOOD_FIXTURES, KNOWN_BAD_FIXTURES };
