// SPDX-License-Identifier: BUSL-1.1
/**
 * Fixtures for P-AF-CLAUSE-01.
 *
 * KNOWN_GOOD: re-ranker emits only valid catalog IDs. Probe MUST pass.
 * KNOWN_BAD : re-ranker emits at least one fabricated ID. Probe MUST fail.
 *
 * The catalog reference set used here mirrors the ISO 42001 + Annex A IDs
 * shipped in @auditforge/catalogues. Consumers (tests / CI) can pass their
 * own `validClauseIds` to widen or narrow it.
 */

import type { CorpusEntry, ReRankerJudgment } from './P-AF-CLAUSE-01.js';

export interface FixtureBundle {
  readonly corpus: readonly CorpusEntry[];
  readonly outputs: readonly { readonly judgments: readonly ReRankerJudgment[] }[];
  /** A representative valid-id set; fixtures only emit ids drawn from this. */
  readonly validClauseIds: readonly string[];
}

/** Subset of the real catalog sufficient for tests. */
export const FIXTURE_VALID_IDS: readonly string[] = [
  // ISO 42001 mandatory clauses
  '4', '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3',
  '6.1.1', '6.1.2', '6.1.3', '6.1.4',
  '7.2', '7.3', '7.4', '7.5',
  '8.1', '8.2', '8.3', '8.4',
  '9.1', '9.2', '9.3',
  '10.1', '10.2',
  // Annex A controls
  'A.2.2', 'A.2.3', 'A.2.4',
  'A.3.2', 'A.3.3',
  'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6',
  'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5',
  'A.6.1.2', 'A.6.1.3',
  'A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'A.6.2.5', 'A.6.2.6', 'A.6.2.7', 'A.6.2.8',
  'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6',
  'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5',
  'A.9.2', 'A.9.3', 'A.9.4',
  'A.10.2', 'A.10.3', 'A.10.4',
];

const goodCorpus: readonly CorpusEntry[] = [
  {
    claim: {
      id: 'kg-001',
      subject: 'training data',
      predicate: 'has',
      object: 'documented provenance',
      text: 'We track lineage for every dataset used to train the recommender.',
    },
    candidates: [
      { clauseId: 'A.7.5', score: 0.91 },
      { clauseId: 'A.7.4', score: 0.62 },
      { clauseId: 'A.4.3', score: 0.40 },
    ],
    expectedAttributions: ['A.7.5'],
  },
  {
    claim: {
      id: 'kg-002',
      subject: 'model retraining',
      predicate: 'is recorded in',
      object: 'change log',
      text: 'Retraining decisions are reviewed by the AI risk committee and logged.',
    },
    candidates: [
      { clauseId: 'A.6.2.6', score: 0.88 },
      { clauseId: '9.3', score: 0.64 },
      { clauseId: 'A.6.2.5', score: 0.45 },
    ],
    expectedAttributions: ['A.6.2.6', '9.3'],
  },
  {
    claim: {
      id: 'kg-003',
      subject: 'AI policy',
      predicate: 'has been',
      object: 'reviewed annually',
      text: 'Our AI policy was last reviewed by the board on 2026-02-12.',
    },
    candidates: [
      { clauseId: 'A.2.2', score: 0.93 },
      { clauseId: 'A.2.4', score: 0.86 },
      { clauseId: '5.2', score: 0.55 },
    ],
    expectedAttributions: ['A.2.4'],
  },
  {
    claim: {
      id: 'kg-004',
      subject: 'incident response',
      predicate: 'covers',
      object: 'AI-specific incidents',
      text: 'The incident response runbook has a section dedicated to AI-system incidents.',
    },
    candidates: [
      { clauseId: 'A.8.4', score: 0.79 },
      { clauseId: 'A.6.2.8', score: 0.41 },
    ],
    expectedAttributions: ['A.8.4'],
  },
  {
    claim: {
      id: 'kg-005',
      subject: 'supplier',
      predicate: 'evaluated',
      object: 'against AI risk criteria',
      text: 'New AI vendors are evaluated using a formal supplier-risk checklist.',
    },
    candidates: [
      { clauseId: 'A.10.3', score: 0.87 },
      { clauseId: 'A.10.2', score: 0.52 },
    ],
    expectedAttributions: ['A.10.3'],
  },
];

const goodOutputs: readonly { readonly judgments: readonly ReRankerJudgment[] }[] = [
  {
    judgments: [
      { clauseId: 'A.7.5', confidence: 0.92, rationale: 'data provenance keyword present' },
      { clauseId: 'A.7.4', confidence: 0.55, rationale: 'related lineage signal' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.6.2.6', confidence: 0.89, rationale: 'monitoring + retraining' },
      { clauseId: '9.3', confidence: 0.62, rationale: 'management review signal' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.2.4', confidence: 0.88, rationale: 'annual policy review' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.8.4', confidence: 0.81, rationale: 'incident communication' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.10.3', confidence: 0.90, rationale: 'supplier evaluation' },
    ],
  },
];

export const KNOWN_GOOD_FIXTURES: FixtureBundle = {
  corpus: goodCorpus,
  outputs: goodOutputs,
  validClauseIds: FIXTURE_VALID_IDS,
};

/**
 * Synthetic re-ranker outputs that include fabricated clause IDs. Anything
 * starting with "A.99" or otherwise outside the catalog must trip the probe.
 */
const badOutputs: readonly { readonly judgments: readonly ReRankerJudgment[] }[] = [
  {
    judgments: [
      { clauseId: 'A.7.5', confidence: 0.92, rationale: 'data provenance' },
      { clauseId: 'A.99.99.99', confidence: 0.71, rationale: 'fabricated id' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.6.2.6', confidence: 0.88, rationale: 'monitoring' },
      { clauseId: 'B.1.1', confidence: 0.55, rationale: 'wrong framework' },
    ],
  },
  {
    judgments: [
      { clauseId: 'NIST-AI-RMF-GV-1.1', confidence: 0.78, rationale: 'wrong framework' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.8.4', confidence: 0.8, rationale: 'incidents' },
      { clauseId: '   ', confidence: 0.1, rationale: 'whitespace id' },
    ],
  },
  {
    judgments: [
      { clauseId: 'A.10.3', confidence: 0.9, rationale: 'suppliers' },
      { clauseId: 'a.10.3 ', confidence: 0.4, rationale: 'lowercase / trailing space' },
    ],
  },
];

export const KNOWN_BAD_FIXTURES: FixtureBundle = {
  corpus: goodCorpus,
  outputs: badOutputs,
  validClauseIds: FIXTURE_VALID_IDS,
};
