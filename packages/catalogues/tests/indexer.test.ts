// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  buildAllCatalogueDocuments,
  indexAllCatalogues,
  type CatalogueDocument,
  type CatalogueSink,
  type EmbeddingSink,
} from '../src/indexer.js';

class FakeEmbedder implements EmbeddingSink {
  callCount = 0;
  async embed(text: string): Promise<number[]> {
    this.callCount++;
    // 4-dim deterministic embedding based on length and char codes.
    return [text.length / 100, (text.charCodeAt(0) || 0) / 256, 0.1, 0.2];
  }
}

class CapturingSink implements CatalogueSink {
  pushedDocs: CatalogueDocument[] = [];
  pushedEmbeddings: Array<{ framework: string; nodeId: string; vector: number[] }> = [];
  async upsertSearch(docs: readonly CatalogueDocument[]): Promise<void> {
    this.pushedDocs.push(...docs);
  }
  async upsertEmbedding(framework: string, nodeId: string, vector: number[]): Promise<void> {
    this.pushedEmbeddings.push({ framework, nodeId, vector });
  }
}

describe('catalogue indexer', () => {
  it('produces documents for every framework', async () => {
    const docs = await buildAllCatalogueDocuments();
    const frameworks = new Set(docs.map((d) => d.framework));
    expect(frameworks).toContain('ISO_42001');
    expect(frameworks).toContain('ANNEX_A');
    expect(frameworks).toContain('EU_AI_ACT');
    expect(frameworks).toContain('NIST_AI_RMF');
    expect(frameworks).toContain('OWASP_LLM_TOP10');
    expect(frameworks).toContain('MITRE_ATLAS');
    expect(frameworks).toContain('AVID');
    expect(frameworks).toContain('MIT_AI_RISK');
    expect(frameworks).toContain('FRAMEWORK_MAPPINGS');
  });

  it('indexAllCatalogues emits every doc to both sinks', async () => {
    const embed = new FakeEmbedder();
    const sink = new CapturingSink();
    const result = await indexAllCatalogues({ embedder: embed, sink });
    expect(result.count).toBeGreaterThan(0);
    expect(result.embedded).toBe(result.count);
    expect(sink.pushedDocs.length).toBe(result.count);
    expect(sink.pushedEmbeddings.length).toBe(result.count);
    // Every doc should have a non-empty text used as embedding input.
    for (const e of sink.pushedEmbeddings) {
      expect(e.vector).toHaveLength(4);
    }
  });

  it('every document has a stable id and non-empty text', async () => {
    const docs = await buildAllCatalogueDocuments();
    const ids = new Set<string>();
    for (const d of docs) {
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.text.length).toBeGreaterThan(0);
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
    }
  });

  it('progress callback fires per framework', async () => {
    const embed = new FakeEmbedder();
    const sink = new CapturingSink();
    const seen: string[] = [];
    await indexAllCatalogues({
      embedder: embed,
      sink,
      onProgress: (framework) => {
        if (!seen.includes(framework)) seen.push(framework);
      },
    });
    expect(seen.length).toBeGreaterThanOrEqual(8);
  });
});
