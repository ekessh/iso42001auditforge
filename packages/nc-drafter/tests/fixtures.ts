// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import {
  type AuditType,
  type Attribution,
  type Claim,
  type ClauseMeta,
  type ContradictionPair,
  type DetectorContext,
  type ExpectedEvidenceBlock,
  InMemoryClauseCatalog,
} from '../src/index.js';

export const FIRM_ID = '11111111-1111-4111-8111-111111111111';
export const ENGAGEMENT_ID = '22222222-2222-4222-8222-222222222222';

export const CATALOG = new InMemoryClauseCatalog([
  {
    clauseId: '4.1',
    family: 'main_body',
    mandatory: true,
    severity: 'high',
    title: 'Understanding the organisation and its context',
  },
  {
    clauseId: '6.1.2',
    family: 'main_body',
    mandatory: true,
    severity: 'high',
    title: 'AI risk assessment',
  },
  {
    clauseId: '7.2',
    family: 'main_body',
    mandatory: true,
    severity: 'medium',
    title: 'Competence',
  },
  {
    clauseId: 'A.6.2.5',
    family: 'annex_a_6',
    mandatory: false,
    severity: 'medium',
    title: 'AI system performance and effectiveness',
  },
  {
    clauseId: 'A.6.2.8',
    family: 'annex_a_6',
    mandatory: false,
    severity: 'medium',
    title: 'AI system monitoring',
  },
  {
    clauseId: 'A.7.4',
    family: 'annex_a_7',
    mandatory: false,
    severity: 'low',
    title: 'Documentation of AI system development',
  },
  {
    clauseId: 'A.10.4',
    family: 'annex_a_10',
    mandatory: false,
    severity: 'high',
    title: 'Third-party AI suppliers',
  },
] satisfies ClauseMeta[]);

export function makeContext(
  overrides: Partial<DetectorContext> = {},
): DetectorContext {
  return {
    firmId: FIRM_ID,
    engagementId: ENGAGEMENT_ID,
    auditType: 'stage_2' satisfies AuditType,
    clauseCatalog: CATALOG,
    now: '2026-05-03T10:00:00.000Z',
    ...overrides,
  };
}

export interface ClaimOverrides {
  id?: string;
  text?: string;
  polarity?: Claim['polarity'];
  controlImplemented?: boolean | null;
  attributions?: Attribution[];
  processMaturity?: Claim['processMaturity'];
  sampleUnitId?: string | null;
  functioning?: boolean | null;
  episodeId?: string;
  capturedAt?: string;
}

export function makeClaim(overrides: ClaimOverrides = {}): Claim {
  return {
    id: overrides.id ?? `claim_${randomUUID()}`,
    engagementId: ENGAGEMENT_ID,
    episodeId: overrides.episodeId ?? `ep_${randomUUID()}`,
    text: overrides.text ?? 'Synthetic claim text.',
    polarity: overrides.polarity ?? 'affirms',
    controlImplemented:
      overrides.controlImplemented === undefined
        ? null
        : overrides.controlImplemented,
    attributions: overrides.attributions ?? [],
    processMaturity:
      overrides.processMaturity === undefined ? null : overrides.processMaturity,
    sampleUnitId:
      overrides.sampleUnitId === undefined ? null : overrides.sampleUnitId,
    functioning:
      overrides.functioning === undefined ? null : overrides.functioning,
    capturedAt: overrides.capturedAt ?? '2026-05-03T09:30:00.000Z',
  };
}

export function attribution(
  clauseId: string,
  controlId: string | null = null,
  confidence = 0.9,
): Attribution {
  return { clauseId, controlId, confidence };
}

export function makeContradictionPair(
  earlier: Claim,
  later: Claim,
  contradictedClause: string,
): ContradictionPair {
  return { earlier, later, contradictedClause };
}

export function makeBlock(
  clauseId: string,
  blockClosed = true,
  expectedTypes: string[] = ['policy_doc', 'training_record'],
): ExpectedEvidenceBlock {
  return { clauseId, expectedTypes, blockClosed };
}
