// SPDX-License-Identifier: BUSL-1.1
/**
 * TrendAnalytics — deterministic NC analytics.
 *
 * Two scopes:
 *
 * - **Per-client**: trends within one client across all engagements
 * - **Scheme-level**: aggregated across the CB's full client portfolio
 *
 * Outputs (all derived purely from the input set, no external calls):
 *
 *   ncFrequencyByType         major_nc / minor_nc / ofi / conformity counts
 *   topRootCauseTopics        ranked clusters from `topicTags` (top N)
 *   timeToCloseDays           p50 / p90 / mean for closed NCs
 *   recurrenceRate            fraction of NCs whose topic re-occurred within
 *                             the same client over the input window
 *
 * Determinism is guaranteed: ordering is stable on (count desc, key asc) and
 * statistics are integer-rounded.
 */
import type {
  ClientId,
  EngagementId,
} from '@auditforge/shared';
import type { Finding, FindingType } from '../types/finding.js';

export interface TrendInputFilter {
  readonly clientId?: ClientId;
  readonly engagementId?: EngagementId;
  /**
   * Only include findings raised on or after this ISO timestamp.
   */
  readonly fromIso?: string;
  /**
   * Only include findings raised before this ISO timestamp.
   */
  readonly toIso?: string;
}

export interface NcFrequency {
  readonly major_nc: number;
  readonly minor_nc: number;
  readonly ofi: number;
  readonly conformity: number;
  readonly total: number;
}

export interface RootCauseCluster {
  readonly topic: string;
  readonly count: number;
  readonly percentage: number; // 0..100, integer-rounded
}

export interface TimeToCloseStats {
  readonly count: number;
  readonly meanDays: number;
  readonly p50Days: number;
  readonly p90Days: number;
}

export interface RecurrenceStats {
  /**
   * Fraction in [0, 1] of NCs whose topic tags re-occurred for the same
   * client at any later point in the input window.
   */
  readonly rate: number;
  readonly recurringCount: number;
  readonly nonRecurringCount: number;
}

export interface TrendReport {
  readonly inputCount: number;
  readonly ncFrequencyByType: NcFrequency;
  readonly topRootCauseTopics: readonly RootCauseCluster[];
  readonly timeToClose: TimeToCloseStats;
  readonly recurrence: RecurrenceStats;
}

export interface TrendAnalyticsOptions {
  /** Max topics returned in `topRootCauseTopics` (default 10). */
  readonly topN?: number;
}

export interface TrendAnalytics {
  perClient(
    findings: readonly Finding[],
    clientId: ClientId,
    filter?: Omit<TrendInputFilter, 'clientId'>,
  ): TrendReport;
  scheme(
    findings: readonly Finding[],
    filter?: TrendInputFilter,
  ): TrendReport;
  compute(findings: readonly Finding[], filter?: TrendInputFilter): TrendReport;
}

export function createTrendAnalytics(
  options: TrendAnalyticsOptions = {},
): TrendAnalytics {
  const topN = options.topN ?? 10;

  function compute(
    findings: readonly Finding[],
    filter: TrendInputFilter = {},
  ): TrendReport {
    const filtered = applyFilter(findings, filter);

    const ncFrequencyByType = computeFrequency(filtered);
    const topRootCauseTopics = computeTopTopics(filtered, topN);
    const timeToClose = computeTimeToClose(filtered);
    const recurrence = computeRecurrence(filtered);

    return {
      inputCount: filtered.length,
      ncFrequencyByType,
      topRootCauseTopics,
      timeToClose,
      recurrence,
    };
  }

  return {
    compute,
    perClient(findings, clientId, filter = {}) {
      return compute(findings, { ...filter, clientId });
    },
    scheme(findings, filter = {}) {
      return compute(findings, filter);
    },
  };
}

function applyFilter(
  findings: readonly Finding[],
  filter: TrendInputFilter,
): readonly Finding[] {
  const fromMs = filter.fromIso ? Date.parse(filter.fromIso) : -Infinity;
  const toMs = filter.toIso ? Date.parse(filter.toIso) : Infinity;
  return findings.filter((f) => {
    if (filter.clientId && f.clientId !== filter.clientId) return false;
    if (filter.engagementId && f.engagementId !== filter.engagementId) {
      return false;
    }
    const t = Date.parse(f.raisedAt);
    return t >= fromMs && t < toMs;
  });
}

function computeFrequency(findings: readonly Finding[]): NcFrequency {
  const counts: Record<FindingType, number> = {
    major_nc: 0,
    minor_nc: 0,
    ofi: 0,
    conformity: 0,
  };
  for (const f of findings) counts[f.type] += 1;
  return { ...counts, total: findings.length };
}

function computeTopTopics(
  findings: readonly Finding[],
  topN: number,
): readonly RootCauseCluster[] {
  const counts = new Map<string, number>();
  let totalTagOccurrences = 0;
  for (const f of findings) {
    for (const tag of f.topicTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      totalTagOccurrences += 1;
    }
  }
  const entries = Array.from(counts.entries());
  // Stable sort: count desc, then topic asc for ties — fully deterministic.
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  const denom = totalTagOccurrences === 0 ? 1 : totalTagOccurrences;
  return entries.slice(0, topN).map(([topic, count]) => ({
    topic,
    count,
    percentage: Math.round((count / denom) * 100),
  }));
}

function computeTimeToClose(findings: readonly Finding[]): TimeToCloseStats {
  const days: number[] = [];
  for (const f of findings) {
    if (f.status !== 'closed') continue;
    const closeEntry = [...f.dispositionHistory]
      .reverse()
      .find((e) => e.action === 'close');
    if (!closeEntry) continue;
    const start = Date.parse(f.raisedAt);
    const end = Date.parse(closeEntry.at);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const diffDays = Math.max(0, (end - start) / 86_400_000);
    days.push(diffDays);
  }
  if (days.length === 0) {
    return { count: 0, meanDays: 0, p50Days: 0, p90Days: 0 };
  }
  const sorted = [...days].sort((a, b) => a - b);
  const sum = sorted.reduce((s, n) => s + n, 0);
  return {
    count: sorted.length,
    meanDays: roundTo(sum / sorted.length, 2),
    p50Days: roundTo(percentile(sorted, 50), 2),
    p90Days: roundTo(percentile(sorted, 90), 2),
  };
}

function computeRecurrence(findings: readonly Finding[]): RecurrenceStats {
  // Group by client; within each client, mark a finding as "recurring" if
  // any LATER finding (by raisedAt) for that client shares a topic tag.
  // NCs only — recurrence on conformity/OFI doesn't make sense.
  const ncs = findings.filter(
    (f) => f.type === 'major_nc' || f.type === 'minor_nc',
  );
  const byClient = new Map<string, Finding[]>();
  for (const f of ncs) {
    const arr = byClient.get(f.clientId) ?? [];
    arr.push(f);
    byClient.set(f.clientId, arr);
  }
  let recurring = 0;
  let nonRecurring = 0;
  for (const arr of byClient.values()) {
    arr.sort((a, b) => Date.parse(a.raisedAt) - Date.parse(b.raisedAt));
    for (let i = 0; i < arr.length; i += 1) {
      const a = arr[i];
      if (!a) continue;
      let hit = false;
      for (let j = i + 1; j < arr.length; j += 1) {
        const b = arr[j];
        if (!b) continue;
        if (shareTag(a.topicTags, b.topicTags)) {
          hit = true;
          break;
        }
      }
      if (hit) recurring += 1;
      else nonRecurring += 1;
    }
  }
  const total = recurring + nonRecurring;
  const rate = total === 0 ? 0 : roundTo(recurring / total, 4);
  return { rate, recurringCount: recurring, nonRecurringCount: nonRecurring };
}

function shareTag(
  a: readonly string[],
  b: readonly string[],
): boolean {
  const set = new Set(a);
  for (const t of b) if (set.has(t)) return true;
  return false;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loV = sorted[lo] as number;
  const hiV = sorted[hi] as number;
  if (lo === hi) return loV;
  const frac = rank - lo;
  return loV + (hiV - loV) * frac;
}

function roundTo(n: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}
