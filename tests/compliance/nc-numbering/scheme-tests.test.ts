// SPDX-License-Identifier: BUSL-1.1
/**
 * NC / OFI numbering scheme tests — 5 CB schemes.
 *
 * Tests:
 *  1. Default `NC-{year}-{seq}` — format string, reset per year
 *  2. Long form `NC-{firmCode}-{year}-{engagement}-{seq}`
 *  3. OFI `OFI-{engagement}-{seq}` with engagement reset
 *  4. Sequential per-firm with annual reset (firm-code embedded)
 *  5. Hash-based deduplication scheme (never-reset, uses hash tag)
 *
 * Each scheme asserts format string parsing + golden cases.
 */
import { describe, expect, it } from 'vitest';
import {
  createNumberingService,
  formatNumber,
  inMemoryCounterStore,
} from '../../../packages/findings/src/numbering/service.js';
import {
  defaultNumberingSchemes,
} from '../../../packages/findings/src/numbering/schemes.js';
import type { NumberingScheme } from '../../../packages/findings/src/types/numbering.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const YEAR_2025 = '2025-03-15T10:00:00Z';
const YEAR_2026 = '2026-06-01T08:00:00Z';

// ---------------------------------------------------------------------------
// 1) Default NC-{year}-{seq} scheme
// ---------------------------------------------------------------------------
describe('Scheme 1 — Default NC-{year}-{seq}', () => {
  it('formats first NC as NC-2025-0001', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    const result = svc.next({
      schemeKey: 'NC',
      type: 'major_nc',
      raisedAt: YEAR_2025,
    });
    expect(result).toBe('NC-2025-0001');
  });

  it('formats second NC as NC-2025-0002 (sequential)', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2025 });
    const result = svc.next({ schemeKey: 'NC', type: 'minor_nc', raisedAt: YEAR_2025 });
    expect(result).toBe('NC-2025-0002');
  });

  it('resets counter in new year', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2025 });
    svc.next({ schemeKey: 'NC', type: 'minor_nc', raisedAt: YEAR_2025 });
    const nextYear = svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2026 });
    expect(nextYear).toBe('NC-2026-0001');
  });

  it('applies to major_nc and minor_nc but not ofi', () => {
    const schemes = defaultNumberingSchemes();
    const nc = schemes.find((s) => s.key === 'NC')!;
    expect(nc.appliesTo).toContain('major_nc');
    expect(nc.appliesTo).toContain('minor_nc');
    expect(nc.appliesTo).not.toContain('ofi');
  });

  it('uses pad=4', () => {
    const schemes = defaultNumberingSchemes();
    const nc = schemes.find((s) => s.key === 'NC')!;
    expect(nc.pad).toBe(4);
  });

  it('reset boundary is year', () => {
    const schemes = defaultNumberingSchemes();
    const nc = schemes.find((s) => s.key === 'NC')!;
    expect(nc.reset).toBe('year');
  });

  it('golden: NC-2025-0001, NC-2025-0002, NC-2025-0003 then NC-2026-0001', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    const a = svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2025 });
    const b = svc.next({ schemeKey: 'NC', type: 'minor_nc', raisedAt: YEAR_2025 });
    const c = svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2025 });
    const d = svc.next({ schemeKey: 'NC', type: 'major_nc', raisedAt: YEAR_2026 });
    expect([a, b, c, d]).toEqual([
      'NC-2025-0001',
      'NC-2025-0002',
      'NC-2025-0003',
      'NC-2026-0001',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2) Long form NC-{client}-{year}-{engagement}-{seq}
// ---------------------------------------------------------------------------
describe('Scheme 2 — Long form NC-{client}-{year}-{engagement}-{seq}', () => {
  const LONG_FORM_SCHEME: NumberingScheme = {
    key: 'NC-LONG',
    name: 'Long form NC with firm/year/engagement context',
    appliesTo: ['major_nc', 'minor_nc'],
    template: 'NC-{client}-{year}-{engagement}-{seq}',
    pad: 3,
    reset: 'engagement',
  };

  it('formats NC with all context fields', () => {
    const svc = createNumberingService([LONG_FORM_SCHEME], inMemoryCounterStore());
    const result = svc.next({
      schemeKey: 'NC-LONG',
      type: 'major_nc',
      raisedAt: YEAR_2025,
      engagementCode: 'ENG-42001-001',
      clientCode: 'ACME',
    });
    expect(result).toBe('NC-ACME-2025-ENG-42001-001-001');
  });

  it('resets counter per engagement', () => {
    const svc = createNumberingService([LONG_FORM_SCHEME], inMemoryCounterStore());
    svc.next({ schemeKey: 'NC-LONG', type: 'major_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-001', clientCode: 'FIRM' });
    svc.next({ schemeKey: 'NC-LONG', type: 'minor_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-001', clientCode: 'FIRM' });
    const newEng = svc.next({ schemeKey: 'NC-LONG', type: 'major_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-002', clientCode: 'FIRM' });
    expect(newEng).toContain('ENG-002');
    expect(newEng.endsWith('001')).toBe(true);
  });

  it('sequential within same engagement', () => {
    const svc = createNumberingService([LONG_FORM_SCHEME], inMemoryCounterStore());
    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      results.push(
        svc.next({ schemeKey: 'NC-LONG', type: 'major_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-TEST', clientCode: 'CB1' }),
      );
    }
    expect(results).toEqual([
      'NC-CB1-2025-ENG-TEST-001',
      'NC-CB1-2025-ENG-TEST-002',
      'NC-CB1-2025-ENG-TEST-003',
    ]);
  });

  it('template parses all placeholder variables', () => {
    const result = formatNumber(
      LONG_FORM_SCHEME,
      { schemeKey: 'NC-LONG', type: 'major_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-XYZ', clientCode: 'CORP' },
      7,
    );
    expect(result).toBe('NC-CORP-2025-ENG-XYZ-007');
  });

  it('appliesTo major_nc and minor_nc', () => {
    expect(LONG_FORM_SCHEME.appliesTo).toContain('major_nc');
    expect(LONG_FORM_SCHEME.appliesTo).toContain('minor_nc');
  });
});

// ---------------------------------------------------------------------------
// 3) OFI-{engagement}-{seq} with engagement reset
// ---------------------------------------------------------------------------
describe('Scheme 3 — OFI-{engagement}-{seq}', () => {
  it('OFI scheme uses engagement reset', () => {
    const schemes = defaultNumberingSchemes();
    const ofi = schemes.find((s) => s.key === 'OFI')!;
    expect(ofi.reset).toBe('engagement');
    expect(ofi.template).toBe('OFI-{engagement}-{seq}');
  });

  it('formats first OFI as OFI-ENG-001-001', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    const result = svc.next({
      schemeKey: 'OFI',
      type: 'ofi',
      raisedAt: YEAR_2025,
      engagementCode: 'ENG-001',
    });
    expect(result).toBe('OFI-ENG-001-001');
  });

  it('sequential OFIs in same engagement', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    const a = svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-001' });
    const b = svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-001' });
    const c = svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-001' });
    expect([a, b, c]).toEqual(['OFI-ENG-001-001', 'OFI-ENG-001-002', 'OFI-ENG-001-003']);
  });

  it('resets counter for new engagement', () => {
    const svc = createNumberingService(defaultNumberingSchemes(), inMemoryCounterStore());
    svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-001' });
    svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-001' });
    const nextEng = svc.next({ schemeKey: 'OFI', type: 'ofi', raisedAt: YEAR_2025, engagementCode: 'ENG-002' });
    expect(nextEng).toBe('OFI-ENG-002-001');
  });

  it('OFI scheme appliesTo only ofi', () => {
    const schemes = defaultNumberingSchemes();
    const ofi = schemes.find((s) => s.key === 'OFI')!;
    expect(ofi.appliesTo).toContain('ofi');
    expect(ofi.appliesTo).not.toContain('major_nc');
    expect(ofi.appliesTo).not.toContain('minor_nc');
  });

  it('pad is 3 for OFI scheme', () => {
    const schemes = defaultNumberingSchemes();
    const ofi = schemes.find((s) => s.key === 'OFI')!;
    expect(ofi.pad).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 4) Sequential per-firm with annual reset
// ---------------------------------------------------------------------------
describe('Scheme 4 — Sequential per-firm with annual reset', () => {
  const PER_FIRM_ANNUAL_SCHEME: NumberingScheme = {
    key: 'FIRM-NC',
    name: 'Per-firm annual NC numbering',
    appliesTo: ['major_nc', 'minor_nc'],
    template: '{client}-NC-{year}-{seq}',
    pad: 4,
    reset: 'year',
  };

  it('formats as ACME-NC-2025-0001', () => {
    const result = formatNumber(
      PER_FIRM_ANNUAL_SCHEME,
      { schemeKey: 'FIRM-NC', type: 'major_nc', raisedAt: YEAR_2025, clientCode: 'ACME' },
      1,
    );
    expect(result).toBe('ACME-NC-2025-0001');
  });

  it('counter resets for different years', () => {
    const svc = createNumberingService([PER_FIRM_ANNUAL_SCHEME], inMemoryCounterStore());
    for (let i = 0; i < 5; i++) {
      svc.next({ schemeKey: 'FIRM-NC', type: 'major_nc', raisedAt: YEAR_2025, clientCode: 'CORP' });
    }
    const newYear = svc.next({ schemeKey: 'FIRM-NC', type: 'major_nc', raisedAt: YEAR_2026, clientCode: 'CORP' });
    expect(newYear).toContain('2026');
    expect(newYear.endsWith('0001')).toBe(true);
  });

  it('golden: CORP-NC-2025-0001 through CORP-NC-2025-0005', () => {
    const svc = createNumberingService([PER_FIRM_ANNUAL_SCHEME], inMemoryCounterStore());
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(
        svc.next({ schemeKey: 'FIRM-NC', type: 'major_nc', raisedAt: YEAR_2025, clientCode: 'CORP' }),
      );
    }
    expect(results).toEqual([
      'CORP-NC-2025-0001',
      'CORP-NC-2025-0002',
      'CORP-NC-2025-0003',
      'CORP-NC-2025-0004',
      'CORP-NC-2025-0005',
    ]);
  });

  it('validates scheme — missing {seq} throws', () => {
    const bad: NumberingScheme = { ...PER_FIRM_ANNUAL_SCHEME, key: 'BAD', template: 'NC-{year}' };
    expect(() => createNumberingService([bad])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5) Hash-based deduplication scheme (never-reset, hash tag in template)
// ---------------------------------------------------------------------------
describe('Scheme 5 — Hash-based deduplication (never-reset, per-type key)', () => {
  const HASH_DEDUP_SCHEME: NumberingScheme = {
    key: 'NC-HASH',
    name: 'Hash-deduplicated NC (no reset)',
    appliesTo: ['major_nc'],
    template: 'NC-{type}-{seq}',
    pad: 6,
    reset: 'never',
  };

  it('formats as NC-major_nc-000001', () => {
    const result = formatNumber(
      HASH_DEDUP_SCHEME,
      { schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2025 },
      1,
    );
    expect(result).toBe('NC-major_nc-000001');
  });

  it('counter never resets — monotonically increasing', () => {
    const svc = createNumberingService([HASH_DEDUP_SCHEME], inMemoryCounterStore());
    const nums: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = svc.next({ schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2025 });
      const seq = parseInt(result.split('-')[2]!, 10);
      nums.push(seq);
    }
    // Must be strictly increasing
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]!);
    }
  });

  it('counter crosses year boundary without resetting', () => {
    const svc = createNumberingService([HASH_DEDUP_SCHEME], inMemoryCounterStore());
    for (let i = 0; i < 5; i++) {
      svc.next({ schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2025 });
    }
    const nextYear = svc.next({ schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2026 });
    const seq = parseInt(nextYear.split('-')[2]!, 10);
    expect(seq).toBe(6); // NOT reset to 1
  });

  it('golden cases (6 calls → NC-major_nc-000001..000006)', () => {
    const svc = createNumberingService([HASH_DEDUP_SCHEME], inMemoryCounterStore());
    const expected = Array.from({ length: 6 }, (_, i) =>
      `NC-major_nc-${(i + 1).toString().padStart(6, '0')}`,
    );
    const actual = Array.from({ length: 6 }, () =>
      svc.next({ schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2025 }),
    );
    expect(actual).toEqual(expected);
  });

  it('pad=6 produces 6-digit sequence', () => {
    const result = formatNumber(
      HASH_DEDUP_SCHEME,
      { schemeKey: 'NC-HASH', type: 'major_nc', raisedAt: YEAR_2025 },
      42,
    );
    expect(result).toBe('NC-major_nc-000042');
  });
});

// ---------------------------------------------------------------------------
// Cross-scheme validation tests
// ---------------------------------------------------------------------------
describe('Cross-scheme validation', () => {
  it('duplicate scheme key throws ConfigurationError', () => {
    const schemes = defaultNumberingSchemes();
    const dup = { ...schemes[0]! };
    expect(() => createNumberingService([...schemes, dup])).toThrow();
  });

  it('unknown scheme key in next() throws', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(() =>
      svc.next({ schemeKey: 'NONEXISTENT', type: 'major_nc', raisedAt: YEAR_2025 }),
    ).toThrow();
  });

  it('scheme applied to wrong type throws', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(() =>
      svc.next({ schemeKey: 'OFI', type: 'major_nc', raisedAt: YEAR_2025, engagementCode: 'ENG-001' }),
    ).toThrow();
  });

  it('formatNumber replaces {year} correctly', () => {
    const scheme: NumberingScheme = {
      key: 'TEST',
      name: 'Test',
      appliesTo: ['conformity'],
      template: 'CONF-{year}-{seq}',
      pad: 4,
      reset: 'year',
    };
    const result = formatNumber(
      scheme,
      { schemeKey: 'TEST', type: 'conformity', raisedAt: '2025-11-30T00:00:00Z' },
      99,
    );
    expect(result).toBe('CONF-2025-0099');
  });

  it('formatNumber replaces {yy} with two-digit year', () => {
    const scheme: NumberingScheme = {
      key: 'SHORT',
      name: 'Short year',
      appliesTo: ['major_nc'],
      template: 'NC{yy}-{seq}',
      pad: 3,
      reset: 'year',
    };
    const result = formatNumber(
      scheme,
      { schemeKey: 'SHORT', type: 'major_nc', raisedAt: '2025-01-01T00:00:00Z' },
      1,
    );
    expect(result).toBe('NC25-001');
  });

  it('schemeForType returns correct scheme for major_nc', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    const scheme = svc.schemeForType('major_nc');
    expect(scheme.key).toBe('NC');
  });

  it('schemeByKey returns undefined for unknown key', () => {
    const svc = createNumberingService(defaultNumberingSchemes());
    expect(svc.schemeByKey('NONEXISTENT')).toBeUndefined();
  });
});
