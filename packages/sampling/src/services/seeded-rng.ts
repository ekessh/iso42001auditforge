// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

/**
 * SeededRng — deterministic, cryptographically seeded PRNG.
 *
 * Strategy:
 *   1. Hash the seed string with SHA-256.
 *   2. Use first 16 bytes as 4 × uint32 to seed `xoshiro128**`.
 *
 * `xoshiro128**` is fast, has period 2^128 - 1, and passes BigCrush. We do
 * NOT need cryptographic randomness for sample selection — we need
 * cryptographic SEEDING so that "seed = engagement-id || population-hash"
 * is unforgeable and reproducible across runs and platforms.
 */
export class SeededRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: string) {
    if (!seed) throw new Error('SeededRng: seed must be non-empty');
    const h = createHash('sha256').update(seed).digest();
    this.s0 = h.readUInt32LE(0);
    this.s1 = h.readUInt32LE(4);
    this.s2 = h.readUInt32LE(8);
    this.s3 = h.readUInt32LE(12);
    // Avoid all-zero state (defensive — SHA-256 of non-empty input is never 0).
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Next uint32 in [0, 2^32). */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Uniform float in [0, 1). 53-bit precision via two u32 draws. */
  nextFloat(): number {
    const hi = this.nextU32() >>> 5; // 27 bits
    const lo = this.nextU32() >>> 6; // 26 bits
    return (hi * 2 ** 26 + lo) / 2 ** 53;
  }

  /** Uniform integer in [0, n). */
  nextInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0)
      throw new Error('SeededRng.nextInt: n must be a positive integer');
    // Rejection sampling for unbiased modulus.
    const limit = Math.floor(0x1_0000_0000 / n) * n;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const r = this.nextU32();
      if (r < limit) return r % n;
    }
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
