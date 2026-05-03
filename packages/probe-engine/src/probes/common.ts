// SPDX-License-Identifier: BUSL-1.1
/**
 * Helpers shared by multiple probes. Keep these tiny and pure so probes stay
 * deterministic given a seed.
 */

/** Mean. */
export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n-1). Returns 0 for n < 2. */
export function stddev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

/** Cosine of angle between two equal-length vectors. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as number;
    const bi = b[i] as number;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Two-sample KS-style supremum distance between two sorted CDFs. */
export function ksDistance(a: readonly number[], b: readonly number[]): number {
  const sa = a.slice().sort((x, y) => x - y);
  const sb = b.slice().sort((x, y) => x - y);
  let i = 0;
  let j = 0;
  let max = 0;
  while (i < sa.length && j < sb.length) {
    const av = sa[i] as number;
    const bv = sb[j] as number;
    if (av <= bv) i++;
    else j++;
    const fa = i / sa.length;
    const fb = j / sb.length;
    const d = Math.abs(fa - fb);
    if (d > max) max = d;
  }
  return max;
}

/** Edit distance between two short strings (Levenshtein). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] as number;
  }
  return prev[b.length] as number;
}

/** Normalise text for keyword matching. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Boolean indicator: does any keyword appear in the text? */
export function containsAny(text: string, keywords: readonly string[]): boolean {
  const t = normalize(text);
  for (const k of keywords) {
    if (t.includes(normalize(k))) return true;
  }
  return false;
}

/** Clamp x to [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
