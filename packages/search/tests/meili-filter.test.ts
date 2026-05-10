// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { MeilisearchAdapter } from '../src/meilisearch/client.js';

describe('MeilisearchAdapter.buildFilterExpression', () => {
  it('always pins engagementId first', () => {
    const f = MeilisearchAdapter.buildFilterExpression('eng-1');
    expect(f).toBe('engagementId = "eng-1"');
  });

  it('AND-joins extra scalar filters', () => {
    const f = MeilisearchAdapter.buildFilterExpression('eng-1', { framework: 'ISO_42001' });
    expect(f).toBe('engagementId = "eng-1" AND framework = "ISO_42001"');
  });

  it('OR-expands array filters', () => {
    const f = MeilisearchAdapter.buildFilterExpression('eng-1', { tags: ['a', 'b'] });
    expect(f).toContain('tags = "a"');
    expect(f).toContain('tags = "b"');
    expect(f).toContain(' OR ');
  });

  it('escapes embedded quotes', () => {
    const f = MeilisearchAdapter.buildFilterExpression('eng-1', { framework: 'has"quote' });
    expect(f).toContain('has\\"quote');
  });

  it('skips empty arrays', () => {
    const f = MeilisearchAdapter.buildFilterExpression('eng-1', { tags: [] });
    expect(f).toBe('engagementId = "eng-1"');
  });
});
