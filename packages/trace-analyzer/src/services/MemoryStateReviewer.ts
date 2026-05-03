// SPDX-License-Identifier: BUSL-1.1
//
// MemoryStateReviewer: reviews persistent agent memory snapshots for
// growth, PII retention, and (via a pluggable cross-tenant detector)
// cross-tenant leakage.
//
// We deliberately keep this interface narrow: storage backends vary widely
// (vector DBs, JSON blobs, key-value, in-memory). Callers supply a
// MemorySnapshot describing the state at a point in time, plus an optional
// PII detector and tenant identifier resolver.

export interface MemoryEntry {
  /** Unique id within the memory store. */
  id: string;
  /** Tenant that owns the entry (when known). */
  tenantId?: string;
  /** Free-text content; PII detection runs over this string. */
  content: string;
  /** ISO timestamp when the entry was created. */
  createdAt: string;
  /** Bytes consumed (best-effort). */
  bytes?: number;
}

export interface MemorySnapshot {
  /** ISO timestamp of the snapshot. */
  takenAt: string;
  /** Full set of entries at this point in time. */
  entries: MemoryEntry[];
}

export interface PiiDetector {
  /** Return zero or more PII categories found in the text (e.g. ["email", "ssn"]). */
  scan(text: string): string[];
}

export interface MemoryReviewReport {
  totalEntries: number;
  totalBytes: number;
  /** Per-snapshot growth (bytes) when multiple snapshots are supplied. */
  growthBytes: number;
  growthRatio: number;
  /** Entries containing PII per detector. */
  piiEntries: Array<{ id: string; categories: string[] }>;
  piiCount: number;
  /** Entry ids whose tenantId differs from the requesting tenant. */
  crossTenantLeaks: string[];
}

const NAIVE_PII = /(?:\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b)/g;

export const NaivePiiDetector: PiiDetector = {
  scan(text: string): string[] {
    const cats: string[] = [];
    if (/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)) cats.push('email');
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) cats.push('ssn');
    if (/\b\d{16}\b/.test(text)) cats.push('credit-card');
    NAIVE_PII.lastIndex = 0; // re-set the global regex's state.
    return cats;
  },
};

export class MemoryStateReviewer {
  constructor(private readonly piiDetector: PiiDetector = NaivePiiDetector) {}

  review(
    snapshots: readonly MemorySnapshot[],
    requestingTenantId?: string,
  ): MemoryReviewReport {
    if (snapshots.length === 0) {
      return {
        totalEntries: 0,
        totalBytes: 0,
        growthBytes: 0,
        growthRatio: 0,
        piiEntries: [],
        piiCount: 0,
        crossTenantLeaks: [],
      };
    }
    const last = snapshots[snapshots.length - 1];
    const first = snapshots[0];
    if (!last || !first) {
      return {
        totalEntries: 0,
        totalBytes: 0,
        growthBytes: 0,
        growthRatio: 0,
        piiEntries: [],
        piiCount: 0,
        crossTenantLeaks: [],
      };
    }
    const sumBytes = (s: MemorySnapshot): number =>
      s.entries.reduce((acc, e) => acc + (e.bytes ?? e.content.length), 0);
    const lastBytes = sumBytes(last);
    const firstBytes = sumBytes(first);
    const growth = lastBytes - firstBytes;
    const growthRatio =
      firstBytes === 0 ? (lastBytes > 0 ? Number.POSITIVE_INFINITY : 0) : growth / firstBytes;

    const piiEntries: MemoryReviewReport['piiEntries'] = [];
    const crossTenantLeaks: string[] = [];
    for (const e of last.entries) {
      const cats = this.piiDetector.scan(e.content);
      if (cats.length > 0) piiEntries.push({ id: e.id, categories: cats });
      if (
        requestingTenantId !== undefined &&
        e.tenantId !== undefined &&
        e.tenantId !== requestingTenantId
      ) {
        crossTenantLeaks.push(e.id);
      }
    }

    return {
      totalEntries: last.entries.length,
      totalBytes: lastBytes,
      growthBytes: growth,
      growthRatio,
      piiEntries,
      piiCount: piiEntries.length,
      crossTenantLeaks,
    };
  }
}
