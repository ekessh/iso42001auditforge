// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { ConfigurationError, ValidationError } from '@auditforge/shared';
import {
  createNumberingService,
  defaultNumberingSchemes,
  formatNumber,
  inMemoryCounterStore,
  type NumberingScheme,
} from '../src/index.js';

describe('Default numbering schemes', () => {
  it('ships with at least 3 schemes covering all finding types', () => {
    const schemes = defaultNumberingSchemes();
    expect(schemes.length).toBeGreaterThanOrEqual(3);
    const types = new Set(schemes.flatMap((s) => s.appliesTo));
    expect(types.has('major_nc')).toBe(true);
    expect(types.has('minor_nc')).toBe(true);
    expect(types.has('ofi')).toBe(true);
    expect(types.has('conformity')).toBe(true);
  });
});

describe('formatNumber golden tests', () => {
  const scheme: NumberingScheme = {
    key: 'NC',
    name: 'NC',
    appliesTo: ['major_nc', 'minor_nc'],
    template: 'NC-{year}-{seq}',
    pad: 4,
    reset: 'year',
  };

  it('NC-{year}-{seq} formats with 4-pad', () => {
    expect(
      formatNumber(
        scheme,
        {
          schemeKey: 'NC',
          type: 'minor_nc',
          raisedAt: '2026-05-03T00:00:00Z',
        },
        7,
      ),
    ).toBe('NC-2026-0007');
  });

  it('handles {yy} {month} {seqRaw} {scheme} {type}', () => {
    const s: NumberingScheme = {
      key: 'X',
      name: 'X',
      appliesTo: ['ofi'],
      template: '{scheme}-{yy}{month}-{seqRaw}-{type}',
      pad: 4,
      reset: 'never',
    };
    expect(
      formatNumber(
        s,
        { schemeKey: 'X', type: 'ofi', raisedAt: '2026-01-15T00:00:00Z' },
        42,
      ),
    ).toBe('X-2601-42-ofi');
  });

  it('substitutes {engagement} and {client}', () => {
    const s: NumberingScheme = {
      key: 'Y',
      name: 'Y',
      appliesTo: ['ofi'],
      template: 'OFI-{client}-{engagement}-{seq}',
      pad: 3,
      reset: 'engagement',
    };
    expect(
      formatNumber(
        s,
        {
          schemeKey: 'Y',
          type: 'ofi',
          raisedAt: '2026-05-03T00:00:00Z',
          engagementCode: 'ENG42',
          clientCode: 'ACME',
        },
        1,
      ),
    ).toBe('OFI-ACME-ENG42-001');
  });

  it('falls back to NOENG / NOCLI when codes missing', () => {
    const s: NumberingScheme = {
      key: 'Z',
      name: 'Z',
      appliesTo: ['ofi'],
      template: '{client}/{engagement}/{seq}',
      pad: 2,
      reset: 'never',
    };
    expect(
      formatNumber(
        s,
        { schemeKey: 'Z', type: 'ofi', raisedAt: '2026-01-01T00:00:00Z' },
        9,
      ),
    ).toBe('NOCLI/NOENG/09');
  });
});

describe('NumberingService.next', () => {
  it('increments sequence per (scheme, year) when reset=year', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(
      svc.next({
        schemeKey: 'NC',
        type: 'minor_nc',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toBe('NC-2026-0001');
    expect(
      svc.next({
        schemeKey: 'NC',
        type: 'major_nc',
        raisedAt: '2026-06-01T00:00:00Z',
      }),
    ).toBe('NC-2026-0002');
    // New year → counter resets.
    expect(
      svc.next({
        schemeKey: 'NC',
        type: 'minor_nc',
        raisedAt: '2027-01-01T00:00:00Z',
      }),
    ).toBe('NC-2027-0001');
  });

  it('increments per engagement when reset=engagement', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    const a1 = svc.next({
      schemeKey: 'OFI',
      type: 'ofi',
      raisedAt: '2026-05-01T00:00:00Z',
      engagementCode: 'ENG1',
    });
    const a2 = svc.next({
      schemeKey: 'OFI',
      type: 'ofi',
      raisedAt: '2026-05-01T00:00:00Z',
      engagementCode: 'ENG1',
    });
    const b1 = svc.next({
      schemeKey: 'OFI',
      type: 'ofi',
      raisedAt: '2026-05-01T00:00:00Z',
      engagementCode: 'ENG2',
    });
    expect(a1).toBe('OFI-ENG1-001');
    expect(a2).toBe('OFI-ENG1-002');
    expect(b1).toBe('OFI-ENG2-001');
  });

  it('throws when reset=engagement but no code provided', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(() =>
      svc.next({
        schemeKey: 'OFI',
        type: 'ofi',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toThrow(ValidationError);
  });

  it('rejects unknown scheme keys', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(() =>
      svc.next({
        schemeKey: 'NOPE',
        type: 'ofi',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toThrow(ConfigurationError);
  });

  it('rejects type/scheme mismatch', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(() =>
      svc.next({
        schemeKey: 'NC',
        type: 'ofi',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toThrow(ValidationError);
  });

  it('schemeForType picks the first matching scheme deterministically', () => {
    const customA: NumberingScheme = {
      key: 'A',
      name: 'A',
      appliesTo: ['minor_nc'],
      template: 'A-{seq}',
      pad: 2,
      reset: 'never',
    };
    const customB: NumberingScheme = {
      key: 'B',
      name: 'B',
      appliesTo: ['minor_nc'],
      template: 'B-{seq}',
      pad: 2,
      reset: 'never',
    };
    const svc = createNumberingService([customA, customB]);
    expect(svc.schemeForType('minor_nc').key).toBe('A');
  });

  it('rejects duplicate scheme keys', () => {
    const a: NumberingScheme = {
      key: 'X',
      name: 'X',
      appliesTo: ['minor_nc'],
      template: 'X-{seq}',
      pad: 2,
      reset: 'never',
    };
    expect(() => createNumberingService([a, a])).toThrow(ConfigurationError);
  });

  it('rejects schemes without {seq} or {seqRaw}', () => {
    const bad: NumberingScheme = {
      key: 'X',
      name: 'X',
      appliesTo: ['minor_nc'],
      template: 'X-static',
      pad: 2,
      reset: 'never',
    };
    expect(() => createNumberingService([bad])).toThrow(ConfigurationError);
  });

  it('rejects pad outside [1,12]', () => {
    const bad: NumberingScheme = {
      key: 'X',
      name: 'X',
      appliesTo: ['minor_nc'],
      template: 'X-{seq}',
      pad: 0,
      reset: 'never',
    };
    expect(() => createNumberingService([bad])).toThrow(ConfigurationError);
  });

  it('uses an injected counter store for persistence', () => {
    const store = inMemoryCounterStore();
    const a = createNumberingService(defaultNumberingSchemes(), store);
    const b = createNumberingService(defaultNumberingSchemes(), store);
    expect(
      a.next({
        schemeKey: 'NC',
        type: 'minor_nc',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toBe('NC-2026-0001');
    // Second service shares the store, so it picks up at 2.
    expect(
      b.next({
        schemeKey: 'NC',
        type: 'major_nc',
        raisedAt: '2026-05-01T00:00:00Z',
      }),
    ).toBe('NC-2026-0002');
  });

  it('reset=never never resets across years', () => {
    const scheme: NumberingScheme = {
      key: 'PERM',
      name: 'PERM',
      appliesTo: ['major_nc'],
      template: 'PERM-{seq}',
      pad: 5,
      reset: 'never',
    };
    const svc = createNumberingService([scheme]);
    expect(
      svc.next({
        schemeKey: 'PERM',
        type: 'major_nc',
        raisedAt: '2020-01-01T00:00:00Z',
      }),
    ).toBe('PERM-00001');
    expect(
      svc.next({
        schemeKey: 'PERM',
        type: 'major_nc',
        raisedAt: '2030-01-01T00:00:00Z',
      }),
    ).toBe('PERM-00002');
  });
});
