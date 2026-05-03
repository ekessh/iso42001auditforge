// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import {
  incidentRecordSchema,
  type IncidentRecord,
} from './domain.js';

/**
 * IncidentWatch — subscribes to A.5.5 incident events from the auditee, stores
 * them per (tenantId, engagementId), and surfaces unresolved/recent items for
 * the next surveillance plan.
 *
 * The class keeps no transport details: callers pump incident objects in via
 * `record()`. A hook (`onRecorded`) lets observers (e.g., the scope adjuster)
 * react synchronously.
 */

export type IncidentListener = (incident: IncidentRecord) => void;

export interface IncidentWatchOptions {
  /** Default lookback window for `recent()` queries in days. */
  defaultLookbackDays?: number;
}

export class IncidentWatch {
  private readonly byEngagement = new Map<string, IncidentRecord[]>();
  private readonly listeners = new Set<IncidentListener>();
  private readonly defaultLookbackDays: number;

  constructor(opts: IncidentWatchOptions = {}) {
    this.defaultLookbackDays = opts.defaultLookbackDays ?? 90;
  }

  on(listener: IncidentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Record an incident (validates strictly).
   * Idempotent on `incidentId` — subsequent records with the same id are
   * treated as updates (same identity).
   */
  record(raw: unknown): IncidentRecord {
    const parsed = incidentRecordSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('invalid incident record', {
        issues: parsed.error.issues.slice(0, 16),
      });
    }
    const inc = parsed.data;
    const key = this.key(inc.tenantId, inc.engagementId);
    const list = this.byEngagement.get(key) ?? [];
    const idx = list.findIndex((x) => x.incidentId === inc.incidentId);
    if (idx >= 0) {
      list[idx] = inc;
    } else {
      list.push(inc);
    }
    this.byEngagement.set(key, list);
    for (const l of this.listeners) l(inc);
    return inc;
  }

  /** All incidents for an engagement (deterministic order: occurredAt desc). */
  list(tenantId: string, engagementId: string): IncidentRecord[] {
    const list = this.byEngagement.get(this.key(tenantId, engagementId));
    if (!list) return [];
    return [...list].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  /**
   * Incidents within the lookback window (`now - days .. now`).
   * If `nowEpochMs` is omitted, uses real wall-clock; tests pass a fixed value.
   */
  recent(
    tenantId: string,
    engagementId: string,
    options: { lookbackDays?: number; nowEpochMs?: number } = {},
  ): IncidentRecord[] {
    const days = options.lookbackDays ?? this.defaultLookbackDays;
    const now = options.nowEpochMs ?? Date.now();
    const cutoff = now - days * 86_400_000;
    return this.list(tenantId, engagementId).filter((i) => {
      const t = Date.parse(i.occurredAt);
      return Number.isFinite(t) && t >= cutoff;
    });
  }

  /** Open (unresolved) incidents for an engagement. */
  open(tenantId: string, engagementId: string): IncidentRecord[] {
    return this.list(tenantId, engagementId).filter((i) => !i.resolved);
  }

  size(): number {
    let n = 0;
    for (const list of this.byEngagement.values()) n += list.length;
    return n;
  }

  private key(tenantId: string, engagementId: string): string {
    return `${tenantId} ${engagementId}`;
  }
}
