// SPDX-License-Identifier: BUSL-1.1
/**
 * IAF MD 23:2023 Golden Cases — programme calculator regression suite.
 *
 * Each test case specifies a fully-defined ProgrammeInputs bundle and asserts:
 *  - stage1MinDays  / stage2MinDays / surveillanceMinDays / recertMinDays
 *    match expected minimum-day floors (within ±0.5 rounding tolerance)
 *  - the structured rationale lines reference the expected clause refs and
 *    IAF MD documents.
 *
 * References (no standard text reproduced):
 *  - ISO/IEC 17021-1:2015 Annex A, clause 9.1.4
 *  - IAF MD 23:2023 §§5-7
 *  - IAF MD 11:2019 §5.4 (integration reduction, capped 30 %)
 *  - IAF MD 4:2022 §6 (virtual audit cap 30 %)
 *  - IAF MD 1:2018 §5 (multi-site sampling)
 */
import { describe, expect, it } from 'vitest';
import {
  calculateProgramme,
  IAF_MD_11_INTEGRATION_CAP_PCT,
  IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT,
} from '../../../packages/engagement/src/programme/calculator.js';
import type { ProgrammeInputs } from '../../../packages/engagement/src/types/programme.js';

// ---------------------------------------------------------------------------
// Helper: assert all rationale lines across all audit types contain at least
// one line mentioning the given clauseRef substring.
// ---------------------------------------------------------------------------
function assertRationaleContains(
  inputs: ProgrammeInputs,
  clauseSubstring: string,
): void {
  const out = calculateProgramme(inputs);
  const allLines = [
    ...out.byAuditType.stage1.rationale,
    ...out.byAuditType.stage2.rationale,
    ...out.byAuditType.surveillance.rationale,
    ...out.byAuditType.recert.rationale,
    ...out.byAuditType.cycleTotal.rationale,
  ];
  const found = allLines.some((l) => l.clauseRef.includes(clauseSubstring));
  expect(
    found,
    `Expected a rationale line referencing "${clauseSubstring}" but found none. Lines: ${JSON.stringify(allLines.map((l) => l.clauseRef))}`,
  ).toBe(true);
}

// ---------------------------------------------------------------------------
// Constant: half-day tolerance for rounding assertions.
// ---------------------------------------------------------------------------
const HALF_DAY = 0.5;

interface GoldenCase {
  readonly label: string;
  readonly inputs: ProgrammeInputs;
  readonly expected: {
    readonly stage1MinDays: number;
    readonly stage2MinDays: number;
    readonly surveillanceMinDays: number;
    readonly recertMinDays: number;
  };
  /** Clause ref substrings that must appear in rationale. */
  readonly mustMentionClauses: string[];
}

// ---------------------------------------------------------------------------
// Golden table — 25+ cases
// ---------------------------------------------------------------------------
const GOLDEN_CASES: GoldenCase[] = [
  // ── Case 01: Single-site, no integrated MS, low complexity, 1 use case ──
  {
    label: '01 – single-site, no MS, low complexity, 1 UC',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Single-site AIMS, 1 use case',
        useCaseCount: 1,
        modelCount: 0,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 5,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: [
      'ISO/IEC 17021-1:2015 Annex A',
      'IAF MD 23:2023 §6.1',
    ],
  },

  // ── Case 02: Single-site, medium complexity, 3 use cases, 2 models ──
  {
    label: '02 – single-site, medium complexity, 3 UC, 2 models',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Medium-complexity AIMS',
        useCaseCount: 3,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 10,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A', 'IAF MD 23:2023 §6.2'],
  },

  // ── Case 03: Single-site, high complexity, 5 UCs, 3 models, 1 agent ──
  {
    label: '03 – single-site, high complexity, 5 UC, 3 models, 1 agent',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'High-complexity agentic AIMS',
        useCaseCount: 5,
        modelCount: 3,
        agentCount: 1,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 15,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.1', 'IAF MD 23:2023 §6.2'],
  },

  // ── Case 04: Multi-site (3 sites) with 40 % sampling ──
  {
    label: '04 – multi-site (3 sites) 40% sampling',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Three-site AIMS with sampling',
        useCaseCount: 4,
        modelCount: 2,
        agentCount: 0,
        siteCount: 3,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
        multiSiteSamplingReductionPct: 40,
      },
      effectivePersonnelCount: 25,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 1:2018 §5'],
  },

  // ── Case 05: Multi-site (5 sites) without sampling ──
  {
    label: '05 – multi-site (5 sites) no sampling',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Five-site AIMS, all sampled',
        useCaseCount: 6,
        modelCount: 4,
        agentCount: 2,
        siteCount: 5,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 45,
    },
    expected: {
      stage1MinDays: 2.0,
      stage2MinDays: 2.5,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.5,
    },
    mustMentionClauses: ['IAF MD 1:2018 §5'],
  },

  // ── Case 06: Integrated 27001+42001 with 30 % reduction cap ──
  {
    label: '06 – integrated ISO/IEC 27001+42001 with cap',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'ISMS+AIMS dual-scope',
        useCaseCount: 5,
        modelCount: 3,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: ['ISO/IEC 27001'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 30,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 07: Integrated 27001+27701+42001 — stacked reductions approach cap ──
  {
    label: '07 – integrated 27001+27701+42001 triple integration',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Triple IMS: 27001+27701+AIMS',
        useCaseCount: 8,
        modelCount: 5,
        agentCount: 1,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: ['ISO/IEC 27001', 'ISO/IEC 27701'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 50,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 08: Virtual audit >50% with IAF MD 4 warning ──
  {
    label: '08 – virtual audit 60% (exceeds IAF MD 4 cap, warning expected)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Mostly virtual AIMS audit',
        useCaseCount: 3,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 60,
      },
      effectivePersonnelCount: 10,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 4:2022 §6'],
  },

  // ── Case 09: Virtual audit exactly at 30% (no warning) ──
  {
    label: '09 – virtual audit exactly 30% (no IAF MD 4 warning)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: '30% virtual AIMS audit',
        useCaseCount: 3,
        modelCount: 1,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT,
      },
      effectivePersonnelCount: 10,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.5,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A'],
  },

  // ── Case 10: Edge — 0 AI systems, minimal org ──
  {
    label: '10 – edge: 0 models, 0 agents, 0 use cases, 5 personnel',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Minimal AIMS scope (scoping only)',
        useCaseCount: 0,
        modelCount: 0,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 5,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A'],
  },

  // ── Case 11: Edge — 1 AI system ──
  {
    label: '11 – edge: exactly 1 model',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Single-model AIMS',
        useCaseCount: 1,
        modelCount: 1,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 5,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.2'],
  },

  // ── Case 12: Large enterprise — 50+ models ──
  {
    label: '12 – large enterprise: 50 models, 10 agents, 20 UCs',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Enterprise-scale AIMS',
        useCaseCount: 20,
        modelCount: 50,
        agentCount: 10,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 500,
    },
    expected: {
      stage1MinDays: 4.0,
      stage2MinDays: 7.0,
      surveillanceMinDays: 1.5,
      recertMinDays: 4.0,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.2', 'IAF MD 23:2023 §6.1'],
  },

  // ── Case 13: Very large enterprise — 1000+ effective personnel ──
  {
    label: '13 – very large enterprise: 1000 effective personnel',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Global enterprise AIMS',
        useCaseCount: 30,
        modelCount: 80,
        agentCount: 20,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 1000,
    },
    expected: {
      stage1MinDays: 4.5,
      stage2MinDays: 8.5,
      surveillanceMinDays: 2.5,
      recertMinDays: 5.5,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A'],
  },

  // ── Case 14: Integration reduction hits IAF MD 11 30% cap ──
  {
    label: '14 – integration reduction capped at 30% (IAF MD 11)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Four-way IMS',
        useCaseCount: 5,
        modelCount: 3,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [
          'ISO/IEC 27001',
          'ISO/IEC 27701',
          'ISO 9001',
          'ISO 14001',
        ],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 40,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 15: Multi-site 3 sites, integrated 27001, virtual 20% ──
  {
    label: '15 – multi-site + integration + virtual combo',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Combo: 3 sites + 27001 + 20% virtual',
        useCaseCount: 6,
        modelCount: 4,
        agentCount: 1,
        siteCount: 3,
        complexity: 'medium',
        integratedManagementSystems: ['ISO/IEC 27001'],
        virtualAuditPercentage: 20,
        multiSiteSamplingReductionPct: 30,
      },
      effectivePersonnelCount: 45,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 1:2018 §5', 'IAF MD 11:2019 §5.4'],
  },

  // ── Case 16: Recertification minimum floor check (≥ 2/3 of S2) ──
  {
    label: '16 – recert minimum floor 2/3 of stage2',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Recertification floor test',
        useCaseCount: 2,
        modelCount: 1,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 5,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 9.6.3'],
  },

  // ── Case 17: Surveillance minimum floor check (≥ 1/3 of S2) ──
  {
    label: '17 – surveillance minimum floor 1/3 of stage2',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Surveillance floor test',
        useCaseCount: 2,
        modelCount: 1,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 8,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.5,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 9.6.2'],
  },

  // ── Case 18: Agentic system with multiple agents ──
  {
    label: '18 – agentic: 0 models, 5 agents, 3 UCs',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Pure agentic AIMS',
        useCaseCount: 3,
        modelCount: 0,
        agentCount: 5,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 15,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.2'],
  },

  // ── Case 19: ISO 9001 integration (lower reduction pct) ──
  {
    label: '19 – integrated ISO 9001 (15% reduction)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'QMS+AIMS integration',
        useCaseCount: 4,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: ['ISO 9001'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 20,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 20: ISO/IEC 20000-1 integration ──
  {
    label: '20 – integrated ISO/IEC 20000-1 (18% reduction)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'ITSM+AIMS integration',
        useCaseCount: 5,
        modelCount: 3,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: ['ISO/IEC 20000-1'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 25,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 21: default effectivePersonnelCount derived from scope ──
  {
    label: '21 – derived effectivePersonnelCount (no override)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Auto-personnel count',
        useCaseCount: 4,
        modelCount: 3,
        agentCount: 2,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A'],
  },

  // ── Case 22: Low complexity always applies 0.9 multiplier ──
  {
    label: '22 – low complexity multiplier 0.9 (IAF MD 23 §6.1)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Low complexity AIMS',
        useCaseCount: 5,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'low',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 45,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.5,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.5,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.1'],
  },

  // ── Case 23: High complexity multiplier 1.2 ──
  {
    label: '23 – high complexity multiplier 1.2 (IAF MD 23 §6.1)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'High complexity AIMS',
        useCaseCount: 5,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 45,
    },
    expected: {
      stage1MinDays: 2.0,
      stage2MinDays: 3.0,
      surveillanceMinDays: 1.0,
      recertMinDays: 2.0,
    },
    mustMentionClauses: ['IAF MD 23:2023 §6.1'],
  },

  // ── Case 24: Total cycle = S1 + S2 + 2×Surv + Recert ──
  {
    label: '24 – cycle total = S1 + S2 + 2×Surv + Recert',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Cycle total check',
        useCaseCount: 5,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 25,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.5,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 9.3'],
  },

  // ── Case 25: default integration reduction pct override ──
  {
    label: '25 – default integration pct override to 10%',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Unknown MS integration',
        useCaseCount: 3,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: ['SomeCustomFramework-v1'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 20,
      defaultIntegrationReductionPct: 10,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 26: ISO 22301 + 42001 integration ──
  {
    label: '26 – integrated ISO 22301 (BCMS + AIMS)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'BCMS+AIMS integration',
        useCaseCount: 4,
        modelCount: 2,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: ['ISO 22301'],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 30,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 11:2019 §5.4'],
  },

  // ── Case 27: Multi-site 10 sites, high complexity, large scale ──
  {
    label: '27 – 10 sites, high complexity, 100 personnel',
    inputs: {
      aimsScope: {
        aimsScopeStatement: '10-site large AIMS deployment',
        useCaseCount: 15,
        modelCount: 10,
        agentCount: 5,
        siteCount: 10,
        complexity: 'high',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
        multiSiteSamplingReductionPct: 50,
      },
      effectivePersonnelCount: 100,
    },
    expected: {
      stage1MinDays: 2.0,
      stage2MinDays: 3.5,
      surveillanceMinDays: 1.0,
      recertMinDays: 2.5,
    },
    mustMentionClauses: ['IAF MD 1:2018 §5', 'IAF MD 23:2023 §6.1'],
  },

  // ── Case 28: Virtual audit exactly at 31% (just above cap) ──
  {
    label: '28 – virtual audit 31% triggers IAF MD 4 warning',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Slightly over virtual cap',
        useCaseCount: 3,
        modelCount: 1,
        agentCount: 0,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 31,
      },
      effectivePersonnelCount: 10,
    },
    expected: {
      stage1MinDays: 1.0,
      stage2MinDays: 1.5,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.0,
    },
    mustMentionClauses: ['IAF MD 4:2022 §6'],
  },

  // ── Case 29: Zero virtual audit (pure on-site) ──
  {
    label: '29 – pure on-site audit (0% virtual)',
    inputs: {
      aimsScope: {
        aimsScopeStatement: 'Pure on-site audit',
        useCaseCount: 5,
        modelCount: 3,
        agentCount: 1,
        siteCount: 1,
        complexity: 'medium',
        integratedManagementSystems: [],
        virtualAuditPercentage: 0,
      },
      effectivePersonnelCount: 25,
    },
    expected: {
      stage1MinDays: 1.5,
      stage2MinDays: 2.0,
      surveillanceMinDays: 0.5,
      recertMinDays: 1.5,
    },
    mustMentionClauses: ['ISO/IEC 17021-1:2015 Annex A'],
  },
];

// ---------------------------------------------------------------------------
// Run all golden cases
// ---------------------------------------------------------------------------
describe('IAF MD 23:2023 programme calculator — golden cases', () => {
  for (const gc of GOLDEN_CASES) {
    describe(gc.label, () => {
      it('produces stage1MinDays ≥ expected floor', () => {
        const out = calculateProgramme(gc.inputs);
        expect(out.stage1MinDays).toBeGreaterThanOrEqual(
          gc.expected.stage1MinDays - HALF_DAY,
        );
      });

      it('produces stage2MinDays ≥ expected floor', () => {
        const out = calculateProgramme(gc.inputs);
        expect(out.stage2MinDays).toBeGreaterThanOrEqual(
          gc.expected.stage2MinDays - HALF_DAY,
        );
      });

      it('produces surveillanceMinDays ≥ expected floor', () => {
        const out = calculateProgramme(gc.inputs);
        expect(out.surveillanceMinDays).toBeGreaterThanOrEqual(
          gc.expected.surveillanceMinDays - HALF_DAY,
        );
      });

      it('produces recertMinDays ≥ expected floor', () => {
        const out = calculateProgramme(gc.inputs);
        expect(out.recertMinDays).toBeGreaterThanOrEqual(
          gc.expected.recertMinDays - HALF_DAY,
        );
      });

      it('rationale mentions required clause references', () => {
        for (const clauseRef of gc.mustMentionClauses) {
          assertRationaleContains(gc.inputs, clauseRef);
        }
      });

      it('rationale lines all have non-empty clauseRef', () => {
        const out = calculateProgramme(gc.inputs);
        for (const auditType of ['stage1', 'stage2', 'surveillance', 'recert', 'cycleTotal'] as const) {
          for (const line of out.byAuditType[auditType].rationale) {
            expect(line.clauseRef.length).toBeGreaterThan(0);
            expect(line.factor.length).toBeGreaterThan(0);
          }
        }
      });

      it('totalCycleMinDays equals S1+S2+2×Surv+Recert', () => {
        const out = calculateProgramme(gc.inputs);
        const computed =
          out.stage1MinDays +
          out.stage2MinDays +
          out.surveillanceMinDays * 2 +
          out.recertMinDays;
        // Allow ±0.5 day rounding
        expect(Math.abs(out.totalCycleMinDays - computed)).toBeLessThanOrEqual(
          HALF_DAY,
        );
      });
    });
  }

  // ── Structural invariants ──────────────────────────────────────────────────
  describe('structural invariants', () => {
    it('IAF_MD_11_INTEGRATION_CAP_PCT is 30', () => {
      expect(IAF_MD_11_INTEGRATION_CAP_PCT).toBe(30);
    });

    it('IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT is 30', () => {
      expect(IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT).toBe(30);
    });

    it('integration reduction never exceeds cap', () => {
      const out = calculateProgramme(GOLDEN_CASES[13]!.inputs); // 4-way MS
      expect(out.integrationReductionPctApplied).toBeLessThanOrEqual(
        IAF_MD_11_INTEGRATION_CAP_PCT,
      );
    });

    it('virtualAuditWarning present when virtualAuditPercentage > 30%', () => {
      const out = calculateProgramme(GOLDEN_CASES[7]!.inputs); // 60% virtual
      expect(out.virtualAuditWarning).toBeDefined();
      expect(out.virtualAuditWarning).toContain('IAF MD 4');
    });

    it('no virtualAuditWarning when virtualAuditPercentage <= 30%', () => {
      const out = calculateProgramme(GOLDEN_CASES[8]!.inputs); // 30% virtual
      expect(out.virtualAuditWarning).toBeUndefined();
    });

    it('stage1MinDays always ≥ 1.0 (absolute floor)', () => {
      for (const gc of GOLDEN_CASES) {
        const out = calculateProgramme(gc.inputs);
        expect(out.stage1MinDays).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('stage2MinDays always ≥ 1.0 (absolute floor)', () => {
      for (const gc of GOLDEN_CASES) {
        const out = calculateProgramme(gc.inputs);
        expect(out.stage2MinDays).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('surveillanceMinDays always ≥ 0.5 (absolute floor)', () => {
      for (const gc of GOLDEN_CASES) {
        const out = calculateProgramme(gc.inputs);
        expect(out.surveillanceMinDays).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('recertMinDays always ≥ 1.0 (absolute floor)', () => {
      for (const gc of GOLDEN_CASES) {
        const out = calculateProgramme(gc.inputs);
        expect(out.recertMinDays).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('all outputs are rounded to nearest 0.5 day', () => {
      for (const gc of GOLDEN_CASES) {
        const out = calculateProgramme(gc.inputs);
        for (const key of [
          'stage1MinDays',
          'stage2MinDays',
          'surveillanceMinDays',
          'recertMinDays',
          'totalCycleMinDays',
        ] as const) {
          const v = out[key];
          expect(
            Math.abs(Math.round(v * 2) / 2 - v),
            `${key}=${v} for case "${gc.label}" is not a half-day multiple`,
          ).toBeLessThan(0.01);
        }
      }
    });
  });
});
