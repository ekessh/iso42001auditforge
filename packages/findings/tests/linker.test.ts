// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { ValidationError } from '@auditforge/shared';
import {
  createMultiClauseLinker,
  fixedCatalogue,
  permissiveCatalogue,
} from '../src/index.js';

describe('MultiClauseLinker', () => {
  const cat = fixedCatalogue({
    clauses: new Map([
      ['ISO_42001', new Set(['4.1', '6.1.2'])],
      ['EU_AI_ACT', new Set(['Art.9'])],
    ]),
    controls: new Set(['A.5.4', 'A.6.2.4']),
  });

  it('accepts a valid clause + control combination', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [{ framework: 'ISO_42001', clauseId: '6.1.2' }],
        [{ controlId: 'A.5.4' }],
      ),
    ).not.toThrow();
  });

  it('rejects unknown clause IDs', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [{ framework: 'ISO_42001', clauseId: '999' }],
        [{ controlId: 'A.5.4' }],
      ),
    ).toThrow(ValidationError);
  });

  it('rejects unknown frameworks', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [{ framework: 'NOPE', clauseId: '1' }],
        [],
      ),
    ).toThrow(ValidationError);
  });

  it('rejects unknown control IDs', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [{ framework: 'ISO_42001', clauseId: '4.1' }],
        [{ controlId: 'A.99.99' }],
      ),
    ).toThrow(ValidationError);
  });

  it('rejects duplicate clause refs', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [
          { framework: 'ISO_42001', clauseId: '4.1' },
          { framework: 'ISO_42001', clauseId: '4.1' },
        ],
        [],
      ),
    ).toThrow(ValidationError);
  });

  it('rejects duplicate control refs', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [{ framework: 'ISO_42001', clauseId: '4.1' }],
        [{ controlId: 'A.5.4' }, { controlId: 'A.5.4' }],
      ),
    ).toThrow(ValidationError);
  });

  it('requires at least one link by default', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() => linker.validate([], [])).toThrow(ValidationError);
  });

  it('accepts empty when requireAtLeastOneClause=false', () => {
    const linker = createMultiClauseLinker(cat, {
      requireAtLeastOneClause: false,
    });
    expect(() => linker.validate([], [])).not.toThrow();
  });

  it('accepts multiple clauses across frameworks', () => {
    const linker = createMultiClauseLinker(cat);
    expect(() =>
      linker.validate(
        [
          { framework: 'ISO_42001', clauseId: '4.1' },
          { framework: 'ISO_42001', clauseId: '6.1.2' },
          { framework: 'EU_AI_ACT', clauseId: 'Art.9' },
        ],
        [{ controlId: 'A.5.4' }, { controlId: 'A.6.2.4' }],
      ),
    ).not.toThrow();
  });

  it('permissiveCatalogue accepts anything', () => {
    const linker = createMultiClauseLinker(permissiveCatalogue());
    expect(() =>
      linker.validate(
        [{ framework: 'WHATEVER', clauseId: 'X' }],
        [{ controlId: 'Y' }],
      ),
    ).not.toThrow();
  });
});
