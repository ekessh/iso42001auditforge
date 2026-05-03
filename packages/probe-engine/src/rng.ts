// SPDX-License-Identifier: BUSL-1.1

/**
 * Deterministic, seedable RNG. We use Mulberry32 — fast, decent statistical
 * properties, 32-bit state, deterministic across architectures.
 *
 * NOT cryptographically secure. Probes use this only for sampling, NEVER for
 * key generation or token signing.
 */
export function mulberry32(seed: number): () => number {
  // Coerce to uint32 so negative seeds round-trip.
  let a = (seed | 0) >>> 0;
  return function rand(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Convenience: pick one element from an array using a seeded RNG. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: empty array');
  }
  const idx = Math.floor(rng() * items.length);
  // Coerce in case rng() returns 1 due to FP edge cases.
  const safe = idx >= items.length ? items.length - 1 : idx;
  return items[safe] as T;
}

/** Fisher-Yates shuffle, seeded. Returns a new array. */
export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
