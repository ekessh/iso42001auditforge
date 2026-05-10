// SPDX-License-Identifier: BUSL-1.1
import {
  loadAnnexAControls,
  loadAvidCategories,
  loadEuAiActArticles,
  loadFrameworkMappings,
  loadIso42001Clauses,
  loadMitAiRiskCategories,
  loadMitreAtlasTechniques,
  loadNistAiRmfSubcategories,
  loadOwaspLlmTop10,
} from './loader.js';
import type { FrameworkId } from './types.js';

export interface CatalogueDocument {
  id: string;
  framework: FrameworkId | string;
  scope: 'catalogues';
  title: string;
  text: string;
  tags: readonly string[];
  payload: Record<string, unknown>;
}

/**
 * Embedding sink — small interface so we can plug in a real LLM provider
 * (Ollama via @auditforge/llm-provider) or a fake in tests without dragging
 * the provider package as a hard dependency on this catalogue package.
 */
export interface EmbeddingSink {
  embed(text: string): Promise<number[]>;
}

/**
 * Catalogue sink — implemented by @auditforge/search's Meilisearch +
 * pgvector adapters. We declare just enough surface here to remain
 * decoupled from the search package version.
 */
export interface CatalogueSink {
  upsertSearch(docs: readonly CatalogueDocument[]): Promise<void>;
  upsertEmbedding(framework: string, nodeId: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
}

export interface IndexCatalogueOpts {
  embedder: EmbeddingSink;
  sink: CatalogueSink;
  /**
   * If true (default), already-cached embeddings are reused. The sink is
   * expected to ON-CONFLICT-update both rows.
   */
  reuseEmbeddings?: boolean;
  /**
   * Optional progress hook — receives (frameworkId, count, total).
   */
  onProgress?: (framework: string, count: number, total: number) => void;
}

export async function buildAllCatalogueDocuments(): Promise<readonly CatalogueDocument[]> {
  const [
    clauses,
    annex,
    eu,
    nist,
    owasp,
    mitre,
    avid,
    mitRisk,
    mappings,
  ] = await Promise.all([
    loadIso42001Clauses(),
    loadAnnexAControls(),
    loadEuAiActArticles(),
    loadNistAiRmfSubcategories(),
    loadOwaspLlmTop10(),
    loadMitreAtlasTechniques(),
    loadAvidCategories(),
    loadMitAiRiskCategories(),
    loadFrameworkMappings(),
  ]);

  const docs: CatalogueDocument[] = [];
  for (const c of clauses) {
    docs.push({
      id: `ISO_42001:${c.id}`,
      framework: 'ISO_42001',
      scope: 'catalogues',
      title: c.title,
      text: `ISO 42001 clause ${c.id}: ${c.title}`,
      tags: ['iso42001', clauseGroup(c.id)],
      payload: { framework: 'ISO_42001', nodeId: c.id, title: c.title },
    });
  }
  for (const a of annex) {
    docs.push({
      id: `ANNEX_A:${a.id}`,
      framework: 'ANNEX_A',
      scope: 'catalogues',
      title: a.title,
      text: `Annex A control ${a.id} (${a.category}): ${a.title}`,
      tags: ['annex-a', a.category],
      payload: { framework: 'ANNEX_A', nodeId: a.id, title: a.title, category: a.category },
    });
  }
  for (const e of eu) {
    docs.push({
      id: `EU_AI_ACT:${e.id}`,
      framework: 'EU_AI_ACT',
      scope: 'catalogues',
      title: e.title,
      text: `EU AI Act article ${e.id} (risk tier: ${e.riskTier}): ${e.title}`,
      tags: ['eu-ai-act', e.riskTier],
      payload: { framework: 'EU_AI_ACT', nodeId: e.id, title: e.title, riskTier: e.riskTier },
    });
  }
  for (const n of nist) {
    docs.push({
      id: `NIST_AI_RMF:${n.id}`,
      framework: 'NIST_AI_RMF',
      scope: 'catalogues',
      title: n.title,
      text: `NIST AI RMF ${n.function} subcategory ${n.id}: ${n.title}`,
      tags: ['nist-ai-rmf', n.function],
      payload: { framework: 'NIST_AI_RMF', nodeId: n.id, title: n.title, function: n.function },
    });
  }
  for (const o of owasp) {
    docs.push({
      id: `OWASP_LLM_TOP10:${o.id}`,
      framework: 'OWASP_LLM_TOP10',
      scope: 'catalogues',
      title: o.title,
      text: `OWASP LLM Top 10 ${o.id}: ${o.title}`,
      tags: ['owasp-llm10', o.id],
      payload: { framework: 'OWASP_LLM_TOP10', nodeId: o.id, title: o.title },
    });
  }
  for (const m of mitre) {
    docs.push({
      id: `MITRE_ATLAS:${m.id}`,
      framework: 'MITRE_ATLAS',
      scope: 'catalogues',
      title: m.title,
      text: `MITRE ATLAS ${m.id} (${m.tactic}): ${m.title}`,
      tags: ['mitre-atlas', m.tactic],
      payload: { framework: 'MITRE_ATLAS', nodeId: m.id, title: m.title, tactic: m.tactic },
    });
  }
  for (const cat of avid) {
    docs.push({
      id: `AVID:${cat.id}`,
      framework: 'AVID',
      scope: 'catalogues',
      title: cat.title,
      text: `AVID category ${cat.id}: ${cat.title}`,
      tags: ['avid', cat.id],
      payload: { framework: 'AVID', nodeId: cat.id, title: cat.title },
    });
    for (const sub of cat.subcategories) {
      docs.push({
        id: `AVID:${sub.id}`,
        framework: 'AVID',
        scope: 'catalogues',
        title: sub.title,
        text: `AVID subcategory ${sub.id}: ${sub.title}`,
        tags: ['avid', cat.id],
        payload: { framework: 'AVID', nodeId: sub.id, title: sub.title, parentId: cat.id },
      });
    }
  }
  for (const cat of mitRisk) {
    docs.push({
      id: `MIT_AI_RISK:${cat.id}`,
      framework: 'MIT_AI_RISK',
      scope: 'catalogues',
      title: cat.title,
      text: `MIT AI Risk category ${cat.id}: ${cat.title}`,
      tags: ['mit-ai-risk'],
      payload: { framework: 'MIT_AI_RISK', nodeId: cat.id, title: cat.title },
    });
    for (const sub of cat.subcategories) {
      docs.push({
        id: `MIT_AI_RISK:${sub.id}`,
        framework: 'MIT_AI_RISK',
        scope: 'catalogues',
        title: sub.title,
        text: `MIT AI Risk subcategory ${sub.id}: ${sub.title}`,
        tags: ['mit-ai-risk'],
        payload: { framework: 'MIT_AI_RISK', nodeId: sub.id, title: sub.title, parentId: cat.id },
      });
    }
  }
  for (const edge of mappings) {
    docs.push({
      id: `MAPPING:${edge.from.framework}:${edge.from.id}->${edge.to.framework}:${edge.to.id}`,
      framework: 'FRAMEWORK_MAPPINGS',
      scope: 'catalogues',
      title: `${edge.from.framework} ${edge.from.id} → ${edge.to.framework} ${edge.to.id}`,
      text: `Cross-framework mapping ${edge.from.framework} ${edge.from.id} ${edge.strength} ${edge.to.framework} ${edge.to.id}: ${edge.rationale}`,
      tags: ['mapping', edge.strength],
      payload: { kind: 'mapping', from: edge.from, to: edge.to, strength: edge.strength, rationale: edge.rationale, confidence: edge.confidence },
    });
  }
  return docs;
}

export async function indexAllCatalogues(opts: IndexCatalogueOpts): Promise<{ count: number; embedded: number }> {
  const docs = await buildAllCatalogueDocuments();
  await opts.sink.upsertSearch(docs);

  let embedded = 0;
  const grouped = new Map<string, CatalogueDocument[]>();
  for (const d of docs) {
    const arr = grouped.get(d.framework) ?? [];
    arr.push(d);
    grouped.set(d.framework, arr);
  }
  for (const [framework, list] of grouped) {
    let count = 0;
    for (const doc of list) {
      const nodeId = stripFrameworkPrefix(doc.id);
      const vector = await opts.embedder.embed(doc.text);
      await opts.sink.upsertEmbedding(framework, nodeId, vector, {
        title: doc.title,
        tags: doc.tags,
        ...doc.payload,
      });
      embedded++;
      count++;
      opts.onProgress?.(framework, count, list.length);
    }
  }
  return { count: docs.length, embedded };
}

function clauseGroup(id: string): string {
  const top = id.split('.')[0];
  return `clause-${top}`;
}

function stripFrameworkPrefix(id: string): string {
  const idx = id.indexOf(':');
  return idx >= 0 ? id.slice(idx + 1) : id;
}
