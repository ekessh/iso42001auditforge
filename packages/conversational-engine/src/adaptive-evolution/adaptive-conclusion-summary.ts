// SPDX-License-Identifier: BUSL-1.1
/**
 * Conclusion summary generator — v3 §15.12 / Phase 7.7.
 *
 * Audit Mode:
 *   - "No NCs identified. N OFIs noted. Recommendation: Conformity."
 *     OR
 *   - "N Major NCs, M Minor NCs, O OFIs identified. Per ISO 17021-1,
 *      conformity withheld pending corrective action review."
 *
 * Readiness Mode:
 *   - "Readiness check complete. AIMS appears ready for certification audit."
 *     + mandatory non-certification disclaimer.
 *
 * The engine NEVER concludes conformity; the auditor does in the signed
 * report. These strings are draft synthesis text, never auto-promoted.
 */
import { z } from 'zod';
import { UuidSchema } from '@auditforge/shared';

export const READINESS_DISCLAIMER =
  'This is a self-assessment using ISO 42001 as the reference framework. ' +
  'It is not a certification or formal audit. Only an accredited certification ' +
  'body can issue ISO 42001 certification. Recommended next step: engage a ' +
  'certification body for Stage 1 audit.';

export const ConclusionSummarySchema = z.object({
  engagementId: UuidSchema,
  mode: z.enum(['audit', 'readiness']),
  text: z.string().min(1).max(10_000),
  disclaimer: z.string().nullable(),
  counts: z.object({
    majorNc: z.number().int().nonnegative(),
    minorNc: z.number().int().nonnegative(),
    ofi: z.number().int().nonnegative(),
  }),
  recommendation: z.enum(['conformity', 'withheld', 'appears_ready']),
});
export type ConclusionSummary = z.infer<typeof ConclusionSummarySchema>;

export interface AuditConclusionInput {
  readonly engagementId: string;
  readonly mode: 'audit';
  readonly counts: {
    majorNc: number;
    minorNc: number;
    ofi: number;
  };
}

export interface ReadinessConclusionInput {
  readonly engagementId: string;
  readonly mode: 'readiness';
}

export function generateAuditConclusionSummary(
  input: AuditConclusionInput,
): ConclusionSummary {
  const { majorNc, minorNc, ofi } = input.counts;
  const totalNc = majorNc + minorNc;
  if (totalNc === 0) {
    return {
      engagementId: input.engagementId,
      mode: 'audit',
      text: `No NCs identified. ${ofi} OFIs noted. Recommendation: Conformity.`,
      disclaimer: null,
      counts: { majorNc, minorNc, ofi },
      recommendation: 'conformity',
    };
  }
  return {
    engagementId: input.engagementId,
    mode: 'audit',
    text:
      `${majorNc} Major NCs, ${minorNc} Minor NCs, ${ofi} OFIs identified. ` +
      `Per ISO 17021-1, conformity withheld pending corrective action review.`,
    disclaimer: null,
    counts: { majorNc, minorNc, ofi },
    recommendation: 'withheld',
  };
}

export function generateReadinessConclusionSummary(
  input: ReadinessConclusionInput,
): ConclusionSummary {
  return {
    engagementId: input.engagementId,
    mode: 'readiness',
    text: 'Readiness check complete. AIMS appears ready for certification audit.',
    disclaimer: READINESS_DISCLAIMER,
    counts: { majorNc: 0, minorNc: 0, ofi: 0 },
    recommendation: 'appears_ready',
  };
}

/** Convenience for callers that already have the mode + counts in hand. */
export function generateConclusionSummary(
  engagementId: string,
  mode: 'audit' | 'readiness',
  counts?: { majorNc: number; minorNc: number; ofi: number },
): ConclusionSummary {
  if (mode === 'audit') {
    return generateAuditConclusionSummary({
      engagementId,
      mode: 'audit',
      counts: counts ?? { majorNc: 0, minorNc: 0, ofi: 0 },
    });
  }
  return generateReadinessConclusionSummary({
    engagementId,
    mode: 'readiness',
  });
}
