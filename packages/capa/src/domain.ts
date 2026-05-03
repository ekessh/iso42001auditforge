// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const CaStatus = z.enum(['proposed', 'accepted', 'rejected', 'implemented', 'verified', 'closed']);
export type CaStatus = z.infer<typeof CaStatus>;

export const EffectivenessOutcome = z.enum(['effective', 'partially_effective', 'ineffective']);
export type EffectivenessOutcome = z.infer<typeof EffectivenessOutcome>;

export const CorrectiveAction = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  findingId: z.string().uuid(),
  proposedBy: z.string().uuid(),
  proposedAt: z.string().datetime(),
  description: z.string().min(10),
  rootCauseAnalysis: z.string().min(10),
  plannedActions: z.array(z.object({ description: z.string(), owner: z.string(), due: z.string().datetime() })).min(1),
  targetCloseDate: z.string().datetime(),
  status: CaStatus,
});
export type CorrectiveAction = z.infer<typeof CorrectiveAction>;

export const CaImplementation = z.object({
  id: z.string().uuid(),
  caId: z.string().uuid(),
  evidenceIds: z.array(z.string().uuid()),
  implementedAt: z.string().datetime(),
  summary: z.string(),
});
export type CaImplementation = z.infer<typeof CaImplementation>;

export const CaVerification = z.object({
  id: z.string().uuid(),
  caId: z.string().uuid(),
  verifiedBy: z.string().uuid(),
  verifiedAt: z.string().datetime(),
  outcome: EffectivenessOutcome,
  nextSurveillanceFollowup: z.boolean(),
  comments: z.string().optional(),
});
export type CaVerification = z.infer<typeof CaVerification>;
