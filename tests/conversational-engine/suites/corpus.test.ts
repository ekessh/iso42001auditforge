// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { annexFamily, isAnnexId, loadCorpus, tripleKey } from '../runners/corpus.js';

describe('corpus loader', () => {
  const corpus = loadCorpus();

  it('loads 50 entries', () => {
    expect(corpus.entries).toHaveLength(50);
  });

  it('every entry has an id, answer, and ground_truth', () => {
    for (const e of corpus.entries) {
      expect(e.id).toMatch(/^C-\d{3}$/);
      expect(e.answer.length).toBeGreaterThan(20);
      expect(e.ground_truth.claims.length).toBeGreaterThanOrEqual(1);
      expect(e.ground_truth.primary_attributions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('covers all 9 Annex A families at least once', () => {
    const seen = new Set<string>();
    for (const e of corpus.entries) {
      for (const a of e.ground_truth.primary_attributions) {
        if (isAnnexId(a.framework)) seen.add(annexFamily(a.nodeId));
      }
    }
    for (const fam of ['A.2', 'A.3', 'A.4', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10']) {
      expect(seen).toContain(fam);
    }
  });

  it('contains at least one contradicts pair', () => {
    const pairs = corpus.entries.filter((e) => e.ground_truth.contradicts !== null);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('every contradicts target is a real entry id', () => {
    const ids = new Set(corpus.entries.map((e) => e.id));
    for (const e of corpus.entries) {
      if (e.ground_truth.contradicts) {
        expect(ids.has(e.ground_truth.contradicts)).toBe(true);
      }
    }
  });

  it('includes the 8 documented audit phases (sample)', () => {
    const phases = new Set(corpus.entries.map((e) => e.audit_phase));
    expect(phases.size).toBeGreaterThanOrEqual(4);
  });

  it('tripleKey is deterministic and case-insensitive', () => {
    const k1 = tripleKey({ subject: 'AI Policy', predicate: 'IS', object: 'Reviewed' });
    const k2 = tripleKey({ subject: 'ai policy', predicate: 'is', object: 'reviewed' });
    expect(k1).toBe(k2);
  });
});
