// SPDX-License-Identifier: BUSL-1.1
//
// Percentile helpers for latency rollups. We use nearest-rank (i.e. linear-
// interpolation-free) percentiles because (a) it matches what most APM
// vendors render in dashboards, (b) it's deterministic for property-based
// testing, and (c) it does not require sort-stable comparison of NaNs.

/**
 * Compute nearest-rank percentile.
 *
 * Sample the value at index `ceil(p * n) - 1` of the sorted array. Returns 0
 * for empty input. `p` must be in [0, 1].
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

/** Compute p50, p90, p95, p99, max in a single pass. */
export function summarisePercentiles(values: readonly number[]): {
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
} {
  if (values.length === 0) {
    return { p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number): number => {
    const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
    return sorted[idx] ?? 0;
  };
  return {
    p50Ms: at(0.5),
    p90Ms: at(0.9),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}
