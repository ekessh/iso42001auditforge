// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { ConflictError, NotFoundError } from '@auditforge/shared';

import { sha256Json } from './hash.js';

/**
 * Auditor-curated prompt batches used by offline / live probes. Each test set
 * is content-addressed by SHA-256 of its (sorted) items so that a test set is
 * reproducible from its hash alone.
 */

export const TestItemSchema = z.object({
  id: z.string().min(1),
  /** Free-form input — usually a prompt, sometimes structured. */
  input: z.union([z.string(), z.record(z.unknown())]),
  /** Expected output / label. Optional for open-ended probes. */
  expected: z.union([z.string(), z.number(), z.boolean(), z.record(z.unknown())]).optional(),
  /** Per-item tags — used to filter subsets. */
  tags: z.array(z.string().min(1)).default([]),
});
export type TestItem = z.infer<typeof TestItemSchema>;

export const TestSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1).max(2_000).default(''),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** Author who curated the set. */
  author: z.string().min(1),
  items: z.array(TestItemSchema).min(1),
  /** SHA-256 of the canonical items array. Set by the manager. */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type TestSet = z.infer<typeof TestSetSchema>;

export const SubsetSelectorSchema = z.object({
  /** Filter by tag (any-of). */
  tags: z.array(z.string().min(1)).default([]),
  /** Sample size. */
  limit: z.number().int().positive().optional(),
  /** Reproducible seed. */
  seed: z.number().int().nonnegative().default(0),
});
export type SubsetSelector = z.infer<typeof SubsetSelectorSchema>;

export interface TestSetManager {
  register(set: Omit<TestSet, 'contentHash'>): TestSet;
  get(id: string, version: string): TestSet;
  list(category?: string): readonly TestSet[];
  /**
   * Curate a per-engagement subset by tag/limit/seed. Returns a deterministic
   * subset with its own content hash so it can be hash-pinned by the WP linker.
   */
  curateSubset(
    setId: string,
    setVersion: string,
    selector: SubsetSelector,
  ): { items: readonly TestItem[]; subsetHash: string };
}

export class InMemoryTestSetManager implements TestSetManager {
  private readonly sets = new Map<string, TestSet>();

  register(input: Omit<TestSet, 'contentHash'>): TestSet {
    const candidate = { ...input, contentHash: sha256Json(input.items) };
    const parsed = TestSetSchema.parse(candidate);
    const key = this.key(parsed.id, parsed.version);
    if (this.sets.has(key)) {
      throw new ConflictError(`TestSet ${key} already registered`, {
        id: parsed.id,
        version: parsed.version,
      });
    }
    this.sets.set(key, parsed);
    return parsed;
  }

  get(id: string, version: string): TestSet {
    const set = this.sets.get(this.key(id, version));
    if (!set) {
      throw new NotFoundError('TestSet', `${id}@${version}`);
    }
    return set;
  }

  list(category?: string): readonly TestSet[] {
    const all = Array.from(this.sets.values());
    return category ? all.filter((s) => s.category === category) : all;
  }

  curateSubset(
    setId: string,
    setVersion: string,
    selector: SubsetSelector,
  ): { items: readonly TestItem[]; subsetHash: string } {
    const set = this.get(setId, setVersion);
    let items = set.items.slice();
    if (selector.tags.length > 0) {
      const want = new Set(selector.tags);
      items = items.filter((i) => i.tags.some((t) => want.has(t)));
    }
    // Stable order — sort by id, then take a deterministic prefix using seed.
    items.sort((a, b) => a.id.localeCompare(b.id));
    if (selector.limit && items.length > selector.limit) {
      // Seeded "stride" sampling so the same seed = same subset.
      const step = Math.max(1, Math.floor(items.length / selector.limit));
      const out: TestItem[] = [];
      let idx = selector.seed % step;
      while (out.length < selector.limit && idx < items.length) {
        const item = items[idx];
        if (item) out.push(item);
        idx += step;
      }
      items = out;
    }
    return {
      items,
      subsetHash: sha256Json({
        setId,
        setVersion,
        selector,
        ids: items.map((i) => i.id),
      }),
    };
  }

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }
}
