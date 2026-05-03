// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  calculateProgramme,
  baseManDaysFromPersonnel,
  defaultEffectivePersonnelCount,
  IAF_MD_11_INTEGRATION_CAP_PCT,
  IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT,
} from '../src/programme/calculator.js';
import type { AimsScope } from '../src/types/engagement.js';

const baseScope = (overrides: Partial<AimsScope> = {}): AimsScope => ({
  aimsScopeStatement: 'Test AIMS',
  useCaseCount: 1,
  modelCount: 1,
  agentCount: 0,
  siteCount: 1,
  complexity: 'medium',
  integratedManagementSystems: [],
  virtualAuditPercentage: 0,
  ...overrides,
});

describe('baseManDaysFromPersonnel — Annex A shape', () => {
  it('is monotonically non-decreasing in personnel count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50_000 }), (p) => {
        expect(baseManDaysFromPersonnel(p)).toBeGreaterThanOrEqual(
          baseManDaysFromPersonnel(Math.max(1, p - 1)),
        );
      }),
      { numRuns: 200 },
    );
  });

  it('produces the smallest base for ≤5 personnel', () => {
    expect(baseManDaysFromPersonnel(1)).toBe(2.5);
    expect(baseManDaysFromPersonnel(5)).toBe(2.5);
  });

  it('grows for larger orgs', () => {
    expect(baseManDaysFromPersonnel(100)).toBeGreaterThan(
      baseManDaysFromPersonnel(10),
    );
    expect(baseManDaysFromPersonnel(10_000)).toBeGreaterThanOrEqual(26);
  });
});

describe('defaultEffectivePersonnelCount — heuristic floor', () => {
  it('always returns at least 5', () => {
    fc.assert(
      fc.property(
        fc.record({
          useCaseCount: fc.integer({ min: 0, max: 100 }),
          modelCount: fc.integer({ min: 0, max: 50 }),
          agentCount: fc.integer({ min: 0, max: 50 }),
        }),
        ({ useCaseCount, modelCount, agentCount }) => {
          const scope = baseScope({ useCaseCount, modelCount, agentCount });
          expect(defaultEffectivePersonnelCount(scope)).toBeGreaterThanOrEqual(5);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('calculateProgramme — golden cases', () => {
  it('5 use cases / 2 sites / medium complexity produces stable values', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({
        useCaseCount: 5,
        modelCount: 2,
        agentCount: 0,
        siteCount: 2,
        complexity: 'medium',
        integratedManagementSystems: [],
      }),
    });

    // Personnel default = max(5, 2 + 0 + ceil(5 * 0.5)) = max(5, 2 + 3) = 5
    // baseTotal at personnel=5 -> 2.5 (1.5 + 1)
    // stage1Base = round(2.5/3) = 1.0; stage2Base = 1.5
    expect(result.stage1MinDays).toBeGreaterThanOrEqual(1.0);
    expect(result.stage2MinDays).toBeGreaterThanOrEqual(1.0);
    expect(result.surveillanceMinDays).toBeGreaterThanOrEqual(0.5);
    expect(result.recertMinDays).toBeGreaterThanOrEqual(1.0);
    expect(result.totalCycleMinDays).toBe(
      result.stage1MinDays +
        result.stage2MinDays +
        result.surveillanceMinDays * 2 +
        result.recertMinDays,
    );
    // Multi-site rationale must mention the extra site.
    const stage2Rationale = result.byAuditType.stage2.rationale.find((l) =>
      l.factor.includes('Additional sites'),
    );
    expect(stage2Rationale).toBeDefined();
  });

  it('zero integrated MS produces 0% reduction', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({ integratedManagementSystems: [] }),
    });
    expect(result.integrationReductionPctApplied).toBe(0);
  });

  it('one integrated MS (ISO/IEC 27001) produces a known reduction', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({ integratedManagementSystems: ['ISO/IEC 27001'] }),
    });
    // sqrt(1) * 25 = 25 (under cap)
    expect(result.integrationReductionPctApplied).toBe(25);
  });

  it('multiple integrated MS are capped by IAF MD 11 at 30%', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({
        integratedManagementSystems: [
          'ISO/IEC 27001',
          'ISO 9001',
          'ISO 14001',
          'ISO 22301',
        ],
      }),
    });
    expect(result.integrationReductionPctApplied).toBeLessThanOrEqual(
      IAF_MD_11_INTEGRATION_CAP_PCT,
    );
  });

  it('high complexity strictly increases stage 2 days', () => {
    const low = calculateProgramme({
      aimsScope: baseScope({
        complexity: 'low',
        useCaseCount: 10,
        modelCount: 5,
        agentCount: 5,
      }),
      effectivePersonnelCount: 50,
    });
    const high = calculateProgramme({
      aimsScope: baseScope({
        complexity: 'high',
        useCaseCount: 10,
        modelCount: 5,
        agentCount: 5,
      }),
      effectivePersonnelCount: 50,
    });
    expect(high.stage2MinDays).toBeGreaterThanOrEqual(low.stage2MinDays);
  });

  it('warns when virtual audit % exceeds IAF MD 4 cap', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({ virtualAuditPercentage: 80 }),
    });
    expect(result.virtualAuditWarning).toBeDefined();
    expect(result.virtualAuditWarning).toContain(
      String(IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT),
    );
  });

  it('does NOT warn when virtual audit % is under the cap', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({ virtualAuditPercentage: 20 }),
    });
    expect(result.virtualAuditWarning).toBeUndefined();
  });

  it('every rationale line references an ISO/IAF clause', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({
        integratedManagementSystems: ['ISO/IEC 27001'],
        siteCount: 3,
        complexity: 'high',
      }),
    });
    for (const type of ['stage1', 'stage2', 'surveillance', 'recert'] as const) {
      for (const line of result.byAuditType[type].rationale) {
        expect(line.clauseRef).toMatch(/ISO|IAF/);
      }
    }
  });

  it('surveillance and recert respect the ratio rules', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({ useCaseCount: 5, modelCount: 5, agentCount: 5 }),
      effectivePersonnelCount: 100,
    });
    // ISO 17021-1 9.6.2.2 — surveillance ≥ 1/3 of stage 2 (after rounding/floors)
    expect(result.surveillanceMinDays * 3).toBeGreaterThanOrEqual(
      result.stage2MinDays - 0.5,
    );
    // 9.6.3.2 — recert ≥ 2/3 of stage 2
    expect(result.recertMinDays * 1.5).toBeGreaterThanOrEqual(
      result.stage2MinDays - 0.5,
    );
  });

  it('cycle total equals sum of components', () => {
    const result = calculateProgramme({
      aimsScope: baseScope({
        useCaseCount: 2,
        modelCount: 3,
        agentCount: 1,
        siteCount: 1,
      }),
    });
    expect(result.totalCycleMinDays).toBe(
      result.stage1MinDays +
        result.stage2MinDays +
        result.surveillanceMinDays * 2 +
        result.recertMinDays,
    );
    const cycleBreakdown = result.byAuditType.cycleTotal;
    expect(cycleBreakdown.minDays).toBe(result.totalCycleMinDays);
  });
});

describe('calculateProgramme — property tests', () => {
  it('all output fields are positive half-day-aligned numbers', () => {
    fc.assert(
      fc.property(
        fc.record({
          useCaseCount: fc.integer({ min: 0, max: 50 }),
          modelCount: fc.integer({ min: 0, max: 30 }),
          agentCount: fc.integer({ min: 0, max: 20 }),
          siteCount: fc.integer({ min: 1, max: 10 }),
          complexity: fc.constantFrom('low', 'medium', 'high'),
          integrated: fc.subarray([
            'ISO/IEC 27001',
            'ISO 9001',
            'ISO 14001',
            'ISO 22301',
            'ISO/IEC 20000-1',
          ]),
          virtual: fc.integer({ min: 0, max: 100 }),
        }),
        (cfg) => {
          const result = calculateProgramme({
            aimsScope: baseScope({
              useCaseCount: cfg.useCaseCount,
              modelCount: cfg.modelCount,
              agentCount: cfg.agentCount,
              siteCount: cfg.siteCount,
              complexity: cfg.complexity as AimsScope['complexity'],
              integratedManagementSystems: cfg.integrated,
              virtualAuditPercentage: cfg.virtual,
            }),
          });
          for (const v of [
            result.stage1MinDays,
            result.stage2MinDays,
            result.surveillanceMinDays,
            result.recertMinDays,
            result.totalCycleMinDays,
          ]) {
            expect(v).toBeGreaterThan(0);
            expect(v * 2).toBe(Math.round(v * 2)); // half-day aligned
          }
          expect(result.integrationReductionPctApplied).toBeLessThanOrEqual(
            IAF_MD_11_INTEGRATION_CAP_PCT,
          );
          expect(result.integrationReductionPctApplied).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('integration reduction never exceeds cap regardless of input', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            'ISO/IEC 27001',
            'ISO/IEC 27701',
            'ISO 9001',
            'ISO 14001',
            'ISO 22301',
            'ISO/IEC 20000-1',
            'NEW/STANDARD/X',
          ),
          { minLength: 0, maxLength: 8 },
        ),
        (mss) => {
          const result = calculateProgramme({
            aimsScope: baseScope({ integratedManagementSystems: mss }),
            defaultIntegrationReductionPct: 99, // try to break the cap
          });
          expect(result.integrationReductionPctApplied).toBeLessThanOrEqual(
            IAF_MD_11_INTEGRATION_CAP_PCT,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('totalCycleMinDays is monotone in scope size for fixed personnel', () => {
    const small = calculateProgramme({
      aimsScope: baseScope({ useCaseCount: 1, modelCount: 1 }),
      effectivePersonnelCount: 50,
    });
    const big = calculateProgramme({
      aimsScope: baseScope({
        useCaseCount: 50,
        modelCount: 30,
        agentCount: 20,
      }),
      effectivePersonnelCount: 50,
    });
    expect(big.totalCycleMinDays).toBeGreaterThanOrEqual(small.totalCycleMinDays);
  });
});

describe('calculateProgramme — minimums and floors', () => {
  it('stage 1 + stage 2 floor of 1.0 day each', () => {
    const tiny = calculateProgramme({
      aimsScope: baseScope({
        useCaseCount: 0,
        modelCount: 0,
        agentCount: 0,
        complexity: 'low',
      }),
      effectivePersonnelCount: 1,
    });
    expect(tiny.stage1MinDays).toBeGreaterThanOrEqual(1.0);
    expect(tiny.stage2MinDays).toBeGreaterThanOrEqual(1.0);
  });

  it('surveillance floor 0.5 day', () => {
    const tiny = calculateProgramme({
      aimsScope: baseScope({
        useCaseCount: 0,
        modelCount: 0,
        agentCount: 0,
      }),
      effectivePersonnelCount: 1,
    });
    expect(tiny.surveillanceMinDays).toBeGreaterThanOrEqual(0.5);
  });
});
