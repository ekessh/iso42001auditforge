// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { CrossEngagementAggregator } from '../src/aggregator.js';
import type { ClosedEngagementSnapshot } from '../src/domain.js';
import { InMemoryPatternRepository, CrossEngagementMemoryQuery } from '../src/query.js';

const baseSnap: ClosedEngagementSnapshot = {
  engagementId: 'eng-acme-001',
  firmId: 'firm-cb-1',
  scopeDimensions: { industry: 'healthcare', model_kind: 'recommender' },
  clauseObservations: [
    { clauseId: 'A.7.4', status: 'evidenced' },
    { clauseId: 'A.7.4', status: 'partial' },
    { clauseId: 'A.7.5', status: 'contradicted' },
    { clauseId: 'A.7.5', status: 'na' },
  ],
  probeOutcomes: [
    { probeId: 'P-LLM-15', passed: false },
    { probeId: 'P-LLM-15', passed: true },
    { probeId: 'P-MCP-01', passed: true },
  ],
};

describe('CrossEngagementAggregator', () => {
  it('produces patterns and never includes auditee identifiers', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo, {
      now: () => new Date('2026-05-01T00:00:00Z'),
    });
    const r = await agg.aggregate(baseSnap);
    expect(r.patternsTouched).toBeGreaterThan(0);
    const all = await repo.exportFirm('firm-cb-1');
    for (const p of all) {
      expect(p.firmId).toBe('firm-cb-1');
      const dimKeys = Object.keys(p.dimensions);
      expect(dimKeys).not.toContain('auditeeName');
      expect(dimKeys).not.toContain('engagement_id');
      expect(p.observation).not.toMatch(/Acme|Jane|John/);
    }
  });

  it('is idempotent — running the same snapshot twice does not duplicate rows', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo, {
      now: () => new Date('2026-05-01T00:00:00Z'),
    });
    await agg.aggregate(baseSnap);
    const sizeAfterFirst = repo.size();
    await agg.aggregate(baseSnap);
    expect(repo.size()).toBe(sizeAfterFirst);
  });

  it('skips clauses with N/A status only', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo);
    await agg.aggregate({
      ...baseSnap,
      clauseObservations: [{ clauseId: 'A.9.1', status: 'na' }],
      probeOutcomes: [],
    });
    const all = await repo.exportFirm('firm-cb-1');
    const clauseRows = all.filter((p) => p.patternKind === 'clause_evidence_failure_rate');
    expect(clauseRows.length).toBe(0);
  });

  it('emits an audit summary when sink is provided', async () => {
    const repo = new InMemoryPatternRepository();
    const calls: Array<{ firmId: string; engagementId: string; patternsTouched: number }> = [];
    const agg = new CrossEngagementAggregator(repo, {
      now: () => new Date('2026-05-01T00:00:00Z'),
      auditSink: {
        async onAggregated(s) {
          calls.push({
            firmId: s.firmId,
            engagementId: s.engagementId,
            patternsTouched: s.patternsTouched,
          });
        },
      },
    });
    const r = await agg.aggregate(baseSnap);
    expect(calls.length).toBe(1);
    expect(calls[0]?.firmId).toBe('firm-cb-1');
    expect(calls[0]?.engagementId).toBe('eng-acme-001');
    expect(calls[0]?.patternsTouched).toBe(r.patternsTouched);
  });

  it('drops candidate rows that fail the anonymization gate', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo);
    const dirtySnap: ClosedEngagementSnapshot = {
      ...baseSnap,
      scopeDimensions: { 'Bad Key': 'value' },
    };
    const r = await agg.aggregate(dirtySnap);
    expect(r.patternsSkipped).toBeGreaterThan(0);
    expect(repo.size()).toBe(0);
  });
});

describe('CrossEngagementMemoryQuery', () => {
  it('filters by patternKind and scope', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo);
    await agg.aggregate(baseSnap);
    const q = new CrossEngagementMemoryQuery(repo);
    const clauseHits = await q.query({
      firmId: 'firm-cb-1',
      patternKind: 'clause_evidence_failure_rate',
    });
    expect(clauseHits.length).toBeGreaterThan(0);
    for (const r of clauseHits) {
      expect(r.patternKind).toBe('clause_evidence_failure_rate');
    }
    const scoped = await q.query({
      firmId: 'firm-cb-1',
      scope: { industry: 'healthcare' },
    });
    expect(scoped.every((r) => r.dimensions['industry'] === 'healthcare')).toBe(true);
  });

  it('exportFirm returns every row for the firm', async () => {
    const repo = new InMemoryPatternRepository();
    const agg = new CrossEngagementAggregator(repo);
    await agg.aggregate(baseSnap);
    const q = new CrossEngagementMemoryQuery(repo);
    const all = await q.exportFirm('firm-cb-1');
    expect(all.length).toBeGreaterThan(0);
    const none = await q.exportFirm('firm-other');
    expect(none.length).toBe(0);
  });

  it('rejects empty firmId', async () => {
    const repo = new InMemoryPatternRepository();
    const q = new CrossEngagementMemoryQuery(repo);
    await expect(q.exportFirm('')).rejects.toThrow(/firmId required/);
  });
});
