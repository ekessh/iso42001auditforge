// SPDX-License-Identifier: BUSL-1.1
/**
 * Aggregator. Given a closed-engagement snapshot (already firm-scoped),
 * produces zero-or-more pattern rows that survive the anonymizer and are
 * upserted into the patterns table.
 *
 * Idempotent: running the same snapshot twice produces identical state. The
 * upsert key is `(firmId, patternKind, scope-canonical)` — implementations
 * MUST hash dimensions canonically so two runs match.
 */

import { createHash, randomUUID } from 'node:crypto';

import { checkPattern } from './anonymize.js';
import type {
  AggregatorAuditSink,
  ClosedEngagementSnapshot,
  CrossEngagementPattern,
  PatternRepository,
} from './domain.js';

export interface AggregatorOptions {
  readonly now?: () => Date;
  readonly auditSink?: AggregatorAuditSink | null;
}

export interface AggregatorResult {
  readonly patternsTouched: number;
  readonly patternsSkipped: number;
  readonly skippedReasons: readonly string[];
}

export class CrossEngagementAggregator {
  private readonly repo: PatternRepository;
  private readonly now: () => Date;
  private readonly sink: AggregatorAuditSink | null;

  constructor(repo: PatternRepository, opts: AggregatorOptions = {}) {
    this.repo = repo;
    this.now = opts.now ?? (() => new Date());
    this.sink = opts.auditSink ?? null;
  }

  async aggregate(snap: ClosedEngagementSnapshot): Promise<AggregatorResult> {
    const candidates = [...buildClauseFailurePatterns(snap), ...buildProbeFailurePatterns(snap)];
    const finalized: CrossEngagementPattern[] = [];
    const skipped: string[] = [];
    const occurredAt = this.now().toISOString();

    for (const c of candidates) {
      const id = this.deterministicId(snap.firmId, c.patternKind, c.dimensions);
      const row: CrossEngagementPattern = {
        ...c,
        id,
        firmId: snap.firmId,
        lastUpdated: occurredAt,
      };
      const gate = checkPattern(row);
      if (!gate.ok) {
        skipped.push(gate.reason ?? 'unknown');
        continue;
      }
      finalized.push(row);
    }

    for (const p of finalized) {
      await this.repo.upsert(p);
    }

    if (this.sink) {
      await this.sink.onAggregated({
        firmId: snap.firmId,
        engagementId: snap.engagementId,
        patternsTouched: finalized.length,
        occurredAt,
      });
    }

    return {
      patternsTouched: finalized.length,
      patternsSkipped: skipped.length,
      skippedReasons: skipped,
    };
  }

  private deterministicId(
    firmId: string,
    kind: string,
    dimensions: Record<string, unknown>,
  ): string {
    const canonical = canonicalize({ firmId, kind, dimensions });
    const h = createHash('sha256').update(canonical).digest('hex').slice(0, 32);
    return `pat_${h}`;
  }
}

interface PendingPattern {
  readonly patternKind: 'clause_evidence_failure_rate' | 'probe_failure_rate';
  readonly dimensions: Record<string, string>;
  readonly observation: string;
  readonly sampleSize: number;
  readonly confidence: number;
}

function buildClauseFailurePatterns(snap: ClosedEngagementSnapshot): readonly PendingPattern[] {
  const total = snap.clauseObservations.length;
  if (total === 0) return [];
  const byClause = new Map<string, { evidenced: number; total: number }>();
  for (const obs of snap.clauseObservations) {
    if (obs.status === 'na') continue;
    const e = byClause.get(obs.clauseId) ?? { evidenced: 0, total: 0 };
    e.total += 1;
    if (obs.status === 'evidenced') e.evidenced += 1;
    byClause.set(obs.clauseId, e);
  }
  const out: PendingPattern[] = [];
  for (const [clauseId, c] of byClause) {
    if (c.total < 1) continue;
    const failureRate = 1 - c.evidenced / c.total;
    out.push({
      patternKind: 'clause_evidence_failure_rate',
      dimensions: { ...snap.scopeDimensions, clause_id: clauseId },
      observation: `clause ${clauseId} fails evidence requirements at ${pct(failureRate)}% across ${c.total} observations`,
      sampleSize: c.total,
      confidence: confidenceForSampleSize(c.total),
    });
  }
  return out;
}

function buildProbeFailurePatterns(snap: ClosedEngagementSnapshot): readonly PendingPattern[] {
  if (snap.probeOutcomes.length === 0) return [];
  const byProbe = new Map<string, { failed: number; total: number }>();
  for (const o of snap.probeOutcomes) {
    const e = byProbe.get(o.probeId) ?? { failed: 0, total: 0 };
    e.total += 1;
    if (!o.passed) e.failed += 1;
    byProbe.set(o.probeId, e);
  }
  const out: PendingPattern[] = [];
  for (const [probeId, c] of byProbe) {
    const failureRate = c.failed / c.total;
    out.push({
      patternKind: 'probe_failure_rate',
      dimensions: { ...snap.scopeDimensions, probe_id: probeId },
      observation: `probe ${probeId} fails on ${pct(failureRate)}% of ${c.total} runs in this scope`,
      sampleSize: c.total,
      confidence: confidenceForSampleSize(c.total),
    });
  }
  return out;
}

function pct(p: number): number {
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

function confidenceForSampleSize(n: number): number {
  if (n <= 1) return 0.2;
  if (n <= 5) return 0.5;
  if (n <= 20) return 0.75;
  return 0.9;
}

function canonicalize(value: unknown): string {
  const visit = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(visit);
    const obj = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = visit(obj[k]);
    return sorted;
  };
  return JSON.stringify(visit(value));
}

export function newPatternId(): string {
  return `pat_${randomUUID().replace(/-/g, '')}`;
}
