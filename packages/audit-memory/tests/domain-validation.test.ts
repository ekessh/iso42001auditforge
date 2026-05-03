// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  ClaimSchema,
  ClaimAttributionSchema,
  EpisodeSchema,
  ENTITY_TYPES,
  RELATION_TYPES,
} from '../src/index.js';

describe('Domain validators', () => {
  it('rejects an Episode with an unknown kind', () => {
    expect(() =>
      EpisodeSchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        firmId: '00000000-0000-4000-8000-000000000002',
        engagementId: '00000000-0000-4000-8000-000000000003',
        kind: 'gossip',
        sourceUtteranceId: null,
        speakerRole: null,
        body: '',
        attachments: [],
        parentEpisodeId: null,
        ingestionTime: '2030-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects a Claim with confidence-less attribution then accepts a valid one', () => {
    expect(() =>
      ClaimAttributionSchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        firmId: '00000000-0000-4000-8000-000000000002',
        engagementId: '00000000-0000-4000-8000-000000000003',
        claimId: '00000000-0000-4000-8000-000000000004',
        framework: 'ISO_42001',
        nodeId: 'A.6.2.5',
        confidence: 1.5,
        rationale: 'r',
        modelInvocationId: '00000000-0000-4000-8000-000000000005',
        status: 'pending',
        createdAt: '2030-01-01T00:00:00.000Z',
        decidedAt: null,
        decidedBy: null,
      }),
    ).toThrow();
  });

  it('exposes the full pre-declared entity-type list', () => {
    expect(ENTITY_TYPES).toContain('AISystem');
    expect(ENTITY_TYPES).toContain('AgentWorkflow');
    expect(ENTITY_TYPES.length).toBeGreaterThanOrEqual(15);
  });

  it('exposes the full pre-declared relation-type list', () => {
    expect(RELATION_TYPES).toContain('contradicts');
    expect(RELATION_TYPES).toContain('supersedes');
    expect(RELATION_TYPES).toContain('depends_on');
    expect(RELATION_TYPES.length).toBeGreaterThanOrEqual(12);
  });

  it('parses a valid claim payload', () => {
    const claim = ClaimSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      firmId: '00000000-0000-4000-8000-000000000002',
      engagementId: '00000000-0000-4000-8000-000000000003',
      schemaVersionId: '00000000-0000-4000-8000-000000000004',
      entityType: 'AISystem',
      subject: 's',
      predicate: 'covers',
      object: 'o',
      evidenceEpisodeIds: [],
      extractedBy: {
        modelName: 'm',
        modelInvocationId: '00000000-0000-4000-8000-000000000005',
      },
      eventTimeStart: '2030-01-01T00:00:00.000Z',
      eventTimeEnd: null,
      ingestionTime: '2030-01-01T00:00:00.000Z',
      validity: 'active',
    });
    expect(claim.id).toBeTruthy();
  });
});
