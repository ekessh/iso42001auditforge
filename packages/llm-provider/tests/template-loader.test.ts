// SPDX-License-Identifier: BUSL-1.1
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PromptTemplateRegistry } from '../src/index.js';

describe('PromptTemplateRegistry.loadFromDir', () => {
  it('loads JSON files from disk and hashes the body', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pt-'));
    writeFileSync(
      path.join(dir, 'a.json'),
      JSON.stringify({ id: 'a', version: 'a.v1', body: 'hello world' }),
    );
    writeFileSync(
      path.join(dir, 'b.json'),
      JSON.stringify({
        id: 'b',
        version: 'b.v1',
        body: 'goodbye',
        metadata: { tier: 'small' },
      }),
    );
    const r = new PromptTemplateRegistry();
    const loaded = r.loadFromDir(dir);
    expect(loaded.length).toBe(2);
    expect(r.has('a.v1')).toBe(true);
    expect(r.get('a.v1').hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.get('b.v1').metadata?.['tier']).toBe('small');
    expect(r.get('a.v1').id).toBe('a');
  });

  it('skips non-JSON entries', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pt-'));
    writeFileSync(path.join(dir, 'README.md'), '# nope');
    writeFileSync(
      path.join(dir, 'a.json'),
      JSON.stringify({ id: 'a', version: 'a.v1', body: 'x' }),
    );
    const r = new PromptTemplateRegistry();
    expect(r.loadFromDir(dir).length).toBe(1);
  });

  it('list() returns all loaded templates', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pt-'));
    writeFileSync(
      path.join(dir, 'a.json'),
      JSON.stringify({ id: 'a', version: 'a.v1', body: 'x' }),
    );
    const r = new PromptTemplateRegistry();
    r.loadFromDir(dir);
    expect(r.list().length).toBe(1);
  });

  it('loads the bundled production templates directory', () => {
    const r = new PromptTemplateRegistry();
    const productionDir = path.join(
      path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''),
      '..',
      'templates',
    );
    const loaded = r.loadFromDir(productionDir);
    expect(loaded.length).toBeGreaterThanOrEqual(3);
    expect(r.has('claim-extraction.v1')).toBe(true);
    expect(r.has('attribution-rerank.v1')).toBe(true);
    expect(r.has('nc-drafting.v1')).toBe(true);
  });
});
