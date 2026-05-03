// SPDX-License-Identifier: BUSL-1.1
/**
 * Programme calculator — minimum man-day calculation for an ISO/IEC 42001
 * AIMS certification programme.
 *
 * **References (no standard text reproduced — clause refs only):**
 * - ISO/IEC 17021-1:2015, clauses 9.1.4 (audit time determination) and
 *   Annex A (Tables A.1, A.2 — relationship between effective personnel
 *   count and audit duration).
 * - IAF MD 5:2019  — duration of QMS / EMS audits.
 * - IAF MD 11:2019 — application to integrated management systems.
 * - IAF MD 4:2022  — use of computer-assisted audit techniques (remote /
 *   virtual audits).
 * - IAF MD 1:2018  — multi-site sampling.
 * - IAF MD 23:2023 — sector-specific application for AIMS (ISO/IEC 42001).
 *
 * The calculator is intentionally **explainable**: every contribution to
 * the final number is recorded as a `ProgrammeRationaleLine` so an
 * accreditation reviewer can re-derive the result line-by-line.
 *
 * Expected calling site: the engagement wizard in
 * `apps/web` / `apps/desktop`. Pure function — no I/O.
 */
import type { AimsScope } from '../types/engagement.js';
import type {
  AuditTypeKey,
  ProgrammeBreakdown,
  ProgrammeInputs,
  ProgrammeOutputs,
  ProgrammeRationaleLine,
} from '../types/programme.js';

/** IAF MD 11 caps the integration reduction at 30 % overall. */
export const IAF_MD_11_INTEGRATION_CAP_PCT = 30;

/** IAF MD 4 caps virtual audit content at 30 % without specific approval. */
export const IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT = 30;

const COMPLEXITY_MULTIPLIER: Readonly<Record<AimsScope['complexity'], number>> =
  Object.freeze({
    low: 0.9,
    medium: 1.0,
    high: 1.2,
  });

/**
 * Per-MS integration reduction defaults. When an integrated MS is in the
 * input list and not present here we fall back to
 * `defaultIntegrationReductionPct`.
 *
 * The intent: highly aligned standards (e.g. ISO/IEC 27001 with AIMS)
 * share a bigger chunk of process audit; less-aligned standards
 * (ISO 9001) share less.
 */
const PER_STANDARD_INTEGRATION_PCT: Readonly<Record<string, number>> =
  Object.freeze({
    'ISO/IEC 27001': 25,
    'ISO/IEC 27701': 22,
    'ISO 9001': 15,
    'ISO 14001': 12,
    'ISO/IEC 20000-1': 18,
    'ISO 22301': 12,
  });

/**
 * Heuristic when the caller has not supplied `effectivePersonnelCount`.
 * Treats each declared model + agent as ~1 effective person and each use
 * case as 0.5 (because use cases share teams). Bounded ≥ 5 so even the
 * smallest scope produces a sensible Annex A row.
 */
export function defaultEffectivePersonnelCount(scope: AimsScope): number {
  const fromArtifacts =
    scope.modelCount + scope.agentCount + Math.ceil(scope.useCaseCount * 0.5);
  return Math.max(5, fromArtifacts);
}

/**
 * Mapping from effective personnel count to base Stage 1 + Stage 2 audit
 * days, reproducing the **shape** of ISO/IEC 17021-1:2015 Annex A
 * Table A.1 without copying its text. Returns the Stage 1 + Stage 2
 * combined base; downstream code splits this into Stage 1 and Stage 2.
 *
 * NOTE: callers in regulated CB deployments must verify this table
 * against their own licensed copy of the standard. Numbers here are
 * representative and intentionally conservative.
 */
export function baseManDaysFromPersonnel(personnel: number): number {
  if (personnel <= 5) return 1.5 + 1;
  if (personnel <= 10) return 2 + 1.5;
  if (personnel <= 15) return 2.5 + 1.5;
  if (personnel <= 25) return 3 + 1.5;
  if (personnel <= 45) return 4 + 1.5;
  if (personnel <= 65) return 5 + 1.5;
  if (personnel <= 85) return 6 + 2;
  if (personnel <= 125) return 7 + 2;
  if (personnel <= 175) return 8 + 2;
  if (personnel <= 275) return 9 + 2;
  if (personnel <= 425) return 10 + 3;
  if (personnel <= 625) return 11 + 3;
  if (personnel <= 875) return 12 + 3;
  if (personnel <= 1175) return 13 + 3;
  if (personnel <= 1550) return 14 + 3;
  if (personnel <= 2025) return 15 + 4;
  if (personnel <= 2675) return 16 + 4;
  if (personnel <= 3450) return 17 + 4;
  if (personnel <= 4350) return 18 + 4;
  if (personnel <= 5450) return 19 + 4;
  if (personnel <= 6800) return 20 + 4;
  if (personnel <= 8500) return 21 + 4;
  if (personnel <= 10700) return 22 + 4;
  return 23 + 5;
}

/** Round to the nearest 0.5 day — standard CB practice for audit duration. */
function roundHalfDay(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Clamp helper. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface BuildContext {
  readonly inputs: ProgrammeInputs;
  readonly personnel: number;
  readonly baseTotal: number;
  readonly stage1Base: number;
  readonly stage2Base: number;
  readonly integrationReductionPct: number;
}

function computeIntegrationReduction(
  scope: AimsScope,
  defaultPct: number,
): { pct: number; perStandard: { name: string; pct: number }[] } {
  const perStandard: { name: string; pct: number }[] = [];
  let sum = 0;
  for (const ms of scope.integratedManagementSystems) {
    const pct =
      PER_STANDARD_INTEGRATION_PCT[ms] !== undefined
        ? PER_STANDARD_INTEGRATION_PCT[ms]
        : defaultPct;
    perStandard.push({ name: ms, pct });
    sum += pct;
  }
  // Diminishing returns when stacking many MS: square-root scale, then
  // cap at IAF MD 11's 30 %.
  const stacked =
    perStandard.length === 0
      ? 0
      : Math.round(Math.sqrt(perStandard.length) * (sum / perStandard.length));
  return {
    pct: clamp(stacked, 0, IAF_MD_11_INTEGRATION_CAP_PCT),
    perStandard,
  };
}

function buildBreakdown(
  ctx: BuildContext,
  type: AuditTypeKey,
  baseDays: number,
  baseRationaleClauseRef: string,
): ProgrammeBreakdown {
  const lines: ProgrammeRationaleLine[] = [];
  const scope = ctx.inputs.aimsScope;

  // 1) Base man-days from Annex A row
  lines.push({
    factor: `Annex A base (${ctx.personnel} effective personnel)`,
    clauseRef: baseRationaleClauseRef,
    delta: baseDays,
    note: `Stage1+Stage2 combined base = ${ctx.baseTotal}`,
  });
  let running = baseDays;

  // 2) Complexity multiplier (IAF MD 23 §6 — AIMS factors)
  const cMul = COMPLEXITY_MULTIPLIER[scope.complexity];
  if (cMul !== 1.0) {
    const delta = roundHalfDay(running * (cMul - 1));
    lines.push({
      factor: `Complexity adjustment (${scope.complexity})`,
      clauseRef: 'IAF MD 23:2023 §6.1',
      delta,
      note: `multiplier=${cMul}`,
    });
    running += delta;
  }

  // 3) AI artefact factor — use cases / models / agents (IAF MD 23 §6.2)
  const artefactScore =
    scope.useCaseCount * 0.05 +
    scope.modelCount * 0.1 +
    scope.agentCount * 0.15;
  if (artefactScore > 0) {
    const delta = roundHalfDay(running * Math.min(0.4, artefactScore));
    lines.push({
      factor: `AI artefact volume (uc=${scope.useCaseCount}, m=${scope.modelCount}, a=${scope.agentCount})`,
      clauseRef: 'IAF MD 23:2023 §6.2',
      delta,
      note: `artefactScore=${artefactScore.toFixed(2)} (capped at 0.40)`,
    });
    running += delta;
  }

  // 4) Multi-site (IAF MD 1)
  if (scope.siteCount > 1) {
    const samplePct = scope.multiSiteSamplingReductionPct ?? 0;
    // Each extra site adds 25 % of the *base* time, then sampling reduces.
    const extraSiteDays = roundHalfDay(
      baseDays * 0.25 * (scope.siteCount - 1) * (1 - samplePct / 100),
    );
    if (extraSiteDays !== 0) {
      lines.push({
        factor: `Additional sites (${scope.siteCount - 1} extra, sampling=${samplePct}%)`,
        clauseRef: 'IAF MD 1:2018 §5',
        delta: extraSiteDays,
      });
      running += extraSiteDays;
    }
  }

  // 5) Integration reduction (IAF MD 11)
  if (
    ctx.integrationReductionPct > 0 &&
    scope.integratedManagementSystems.length > 0
  ) {
    const delta = -roundHalfDay(
      running * (ctx.integrationReductionPct / 100),
    );
    lines.push({
      factor: `Integrated management systems (${scope.integratedManagementSystems.join(
        ', ',
      )})`,
      clauseRef: 'IAF MD 11:2019 §5.4',
      delta,
      note: `applied=${ctx.integrationReductionPct}% (capped at ${IAF_MD_11_INTEGRATION_CAP_PCT}%)`,
    });
    running += delta;
  }

  // 6) Virtual audit (IAF MD 4) — does NOT reduce man-days, but warns
  if (scope.virtualAuditPercentage > IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT) {
    lines.push({
      factor: `Virtual audit content`,
      clauseRef: 'IAF MD 4:2022 §6',
      delta: 0,
      note: `virtual=${scope.virtualAuditPercentage}% exceeds ${IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT}% cap; CB approval required`,
    });
  }

  // 7) Surveillance / recert scaling (per ISO/IEC 17021-1 9.6.2.2 / 9.6.3)
  // — applied by the caller via different `baseDays`; nothing here.

  // Floor: Stage 1 must be ≥ 1.0 day, Stage 2 ≥ 1.0 day, surveillance ≥ 0.5 d
  const minByType: Record<AuditTypeKey, number> = {
    stage1: 1.0,
    stage2: 1.0,
    surveillance: 0.5,
    recert: 1.0,
    cycleTotal: 0,
  };
  const finalDays = Math.max(roundHalfDay(running), minByType[type]);
  if (finalDays !== roundHalfDay(running)) {
    lines.push({
      factor: `Minimum-duration floor (${type})`,
      clauseRef: 'ISO/IEC 17021-1:2015 9.1.4',
      delta: finalDays - roundHalfDay(running),
    });
  }

  return { minDays: finalDays, rationale: Object.freeze(lines) };
}

/**
 * Calculate the minimum audit days for the certification cycle.
 *
 * Returns deterministic outputs with structured rationale so the result
 * can be audit-trailed. Values are rounded to the nearest half-day.
 *
 * @example
 * ```ts
 * const result = calculateProgramme({
 *   aimsScope: {
 *     aimsScopeStatement: 'Customer-facing LLM assistant',
 *     useCaseCount: 5,
 *     modelCount: 2,
 *     agentCount: 0,
 *     siteCount: 1,
 *     complexity: 'medium',
 *     integratedManagementSystems: ['ISO/IEC 27001'],
 *     virtualAuditPercentage: 20,
 *   },
 * });
 * // result.totalCycleMinDays   -> e.g. 13.5
 * // result.byAuditType.stage2  -> { minDays: 4, rationale: [...] }
 * ```
 *
 * @see ISO/IEC 17021-1:2015 clauses 9.1.4 + Annex A
 * @see IAF MD 23:2023 §§5–7 (AIMS-specific factors)
 * @see IAF MD 11:2019 (integration reduction; capped at 30 %)
 * @see IAF MD 4:2022 (virtual audit)
 * @see IAF MD 1:2018 (multi-site sampling)
 */
export function calculateProgramme(
  inputs: ProgrammeInputs,
): ProgrammeOutputs {
  const scope = inputs.aimsScope;
  const personnel =
    inputs.effectivePersonnelCount ?? defaultEffectivePersonnelCount(scope);
  const baseTotal = baseManDaysFromPersonnel(personnel);

  // Standard Annex A split: Stage 1 ≈ 1/3 of (S1+S2) base, Stage 2 ≈ 2/3.
  // Round each side to half-day independently.
  const stage1Base = roundHalfDay(baseTotal * (1 / 3));
  const stage2Base = roundHalfDay(baseTotal - stage1Base);

  const { pct: integrationReductionPct, perStandard } =
    computeIntegrationReduction(
      scope,
      inputs.defaultIntegrationReductionPct ?? 20,
    );

  const ctx: BuildContext = {
    inputs,
    personnel,
    baseTotal,
    stage1Base,
    stage2Base,
    integrationReductionPct,
  };

  const stage1 = buildBreakdown(
    ctx,
    'stage1',
    stage1Base,
    'ISO/IEC 17021-1:2015 Annex A.1 (Stage 1 portion)',
  );
  const stage2 = buildBreakdown(
    ctx,
    'stage2',
    stage2Base,
    'ISO/IEC 17021-1:2015 Annex A.1 (Stage 2 portion)',
  );

  // Surveillance ≥ 1/3 of stage2 (ISO/IEC 17021-1 9.6.2.2)
  const surveillanceBase = roundHalfDay(stage2.minDays * (1 / 3));
  const surveillance = buildBreakdown(
    ctx,
    'surveillance',
    surveillanceBase,
    'ISO/IEC 17021-1:2015 9.6.2.2 (≥1/3 of initial certification time)',
  );

  // Recert ≥ 2/3 of stage2 (ISO/IEC 17021-1 9.6.3.2)
  const recertBase = roundHalfDay(stage2.minDays * (2 / 3));
  const recert = buildBreakdown(
    ctx,
    'recert',
    recertBase,
    'ISO/IEC 17021-1:2015 9.6.3.2 (≥2/3 of initial certification time)',
  );

  const totalCycle = roundHalfDay(
    stage1.minDays +
      stage2.minDays +
      surveillance.minDays * 2 +
      recert.minDays,
  );

  const cycleRationale: ProgrammeRationaleLine[] = [
    {
      factor: 'Stage 1 contribution',
      clauseRef: 'ISO/IEC 17021-1:2015 9.3.1',
      delta: stage1.minDays,
    },
    {
      factor: 'Stage 2 contribution',
      clauseRef: 'ISO/IEC 17021-1:2015 9.3.2',
      delta: stage2.minDays,
    },
    {
      factor: 'Two surveillance visits',
      clauseRef: 'ISO/IEC 17021-1:2015 9.6.2.2',
      delta: surveillance.minDays * 2,
      note: `2 × ${surveillance.minDays}`,
    },
    {
      factor: 'Recertification',
      clauseRef: 'ISO/IEC 17021-1:2015 9.6.3.2',
      delta: recert.minDays,
    },
  ];

  if (perStandard.length > 0) {
    cycleRationale.push({
      factor: `Integration reduction applied`,
      clauseRef: 'IAF MD 11:2019 §5.4',
      delta: 0,
      note: perStandard
        .map((p) => `${p.name}=${p.pct}%`)
        .concat(`combined=${integrationReductionPct}%`)
        .join('; '),
    });
  }

  const byAuditType: Record<AuditTypeKey, ProgrammeBreakdown> = {
    stage1,
    stage2,
    surveillance,
    recert,
    cycleTotal: {
      minDays: totalCycle,
      rationale: Object.freeze(cycleRationale),
    },
  };

  const out: ProgrammeOutputs = {
    stage1MinDays: stage1.minDays,
    stage2MinDays: stage2.minDays,
    surveillanceMinDays: surveillance.minDays,
    recertMinDays: recert.minDays,
    totalCycleMinDays: totalCycle,
    byAuditType: Object.freeze(byAuditType),
    integrationReductionPctApplied: integrationReductionPct,
    ...(scope.virtualAuditPercentage > IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT
      ? {
          virtualAuditWarning: `Virtual content ${scope.virtualAuditPercentage}% exceeds IAF MD 4 cap of ${IAF_MD_4_VIRTUAL_AUDIT_CAP_PCT}%`,
        }
      : {}),
  };
  return out;
}
