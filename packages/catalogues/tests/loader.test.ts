// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  loadAllCatalogues,
  loadAnnexAControls,
  loadAvidCategories,
  loadEuAiActArticles,
  loadFrameworkMappings,
  loadIso42001Clauses,
  loadMitAiRiskCategories,
  loadMitreAtlasTechniques,
  loadNistAiRmfSubcategories,
  loadOwaspLlmTop10,
} from '../src/loader.js';

describe('catalogues loader', () => {
  it('loads ISO 42001 clauses with required clauses present', async () => {
    const clauses = await loadIso42001Clauses();
    expect(clauses.length).toBeGreaterThanOrEqual(20);
    const ids = clauses.map((c) => c.id);
    for (const must of ['4', '5', '6', '7', '8', '9', '10', '6.1.2', '6.1.3', '6.1.4', '8.2', '9.2', '10.2']) {
      expect(ids).toContain(must);
    }
  });

  it('every ISO 42001 clause has a non-empty title and no copyrighted text leak (heuristic)', async () => {
    const clauses = await loadIso42001Clauses();
    for (const c of clauses) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThan(200);
    }
  });

  it('loads Annex A controls with all category roots', async () => {
    const controls = await loadAnnexAControls();
    const ids = controls.map((c) => c.id);
    for (const must of ['A.2', 'A.3', 'A.4', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10']) {
      expect(ids).toContain(must);
    }
  });

  it('loads EU AI Act articles with risk-tier assignments', async () => {
    const articles = await loadEuAiActArticles();
    expect(articles.find((a) => a.id === '5')?.riskTier).toBe('prohibited');
    expect(articles.find((a) => a.id === '9')?.riskTier).toBe('high');
    expect(articles.find((a) => a.id === '50')?.riskTier).toBe('limited');
    expect(articles.find((a) => a.id === '53')?.riskTier).toBe('general-purpose');
  });

  it('loads NIST AI RMF with all four functions represented', async () => {
    const subs = await loadNistAiRmfSubcategories();
    const fns = new Set(subs.map((s) => s.function));
    expect(fns.has('GOVERN')).toBe(true);
    expect(fns.has('MAP')).toBe(true);
    expect(fns.has('MEASURE')).toBe(true);
    expect(fns.has('MANAGE')).toBe(true);
  });

  it('loads OWASP LLM Top 10 with exactly 10 entries', async () => {
    const risks = await loadOwaspLlmTop10();
    expect(risks).toHaveLength(10);
    expect(risks.map((r) => r.id).sort()).toEqual([
      'LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05',
      'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10',
    ]);
  });

  it('loads MITRE ATLAS techniques with valid IDs', async () => {
    const techniques = await loadMitreAtlasTechniques();
    expect(techniques.length).toBeGreaterThan(20);
    for (const t of techniques) {
      expect(t.id).toMatch(/^AML\.T\d{4}$/);
    }
  });

  it('loads AVID categories with S/E/P top-level', async () => {
    const cats = await loadAvidCategories();
    expect(cats.map((c) => c.id).sort()).toEqual(['E', 'P', 'S']);
  });

  it('loads MIT AI risk categories with subcategories', async () => {
    const cats = await loadMitAiRiskCategories();
    expect(cats.length).toBeGreaterThanOrEqual(7);
    for (const c of cats) {
      expect(c.subcategories.length).toBeGreaterThan(0);
    }
  });

  it('loads framework mappings with valid edge structure', async () => {
    const edges = await loadFrameworkMappings();
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
      expect(['equivalent', 'subsumes', 'supports', 'partial', 'referenced_by']).toContain(e.strength);
    }
  });

  it('loadAllCatalogues returns every catalogue populated', async () => {
    const all = await loadAllCatalogues();
    expect(all.iso42001Clauses.length).toBeGreaterThan(0);
    expect(all.annexAControls.length).toBeGreaterThan(0);
    expect(all.euAiActArticles.length).toBeGreaterThan(0);
    expect(all.nistAiRmfSubcategories.length).toBeGreaterThan(0);
    expect(all.owaspLlmTop10.length).toBeGreaterThan(0);
    expect(all.mitreAtlasTechniques.length).toBeGreaterThan(0);
    expect(all.avidCategories.length).toBeGreaterThan(0);
    expect(all.mitAiRiskCategories.length).toBeGreaterThan(0);
    expect(all.frameworkMappings.length).toBeGreaterThan(0);
  });
});
