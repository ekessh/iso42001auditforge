// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema } from '../compat/shared.js';

/**
 * Stakeholder roles per design § 3.3 (Stakeholder Map). These map to
 * ISO/IEC 42001 clause 4.2 (interested parties) and Annex A.3
 * (organisational roles for AI).
 */
export const StakeholderRoleSchema = z.enum([
  'developer',
  'data_scientist',
  'mlops',
  'business_owner',
  'compliance',
  'end_user',
  'data_protection_officer',
  'security_officer',
  'risk_owner',
  'human_reviewer',
]);
export type StakeholderRole = z.infer<typeof StakeholderRoleSchema>;

export const AiSystemStakeholderSchema = z.object({
  id: UuidSchema,
  aiSystemId: UuidSchema,
  role: StakeholderRoleSchema,
  displayName: z.string().min(1).max(240),
  email: z.string().email().optional(),
  department: z.string().max(240).optional(),
  responsibilities: z.array(z.string().min(1).max(2000)).default([]),
  isPrimaryAccountable: z.boolean().default(false),
});
export type AiSystemStakeholder = z.infer<typeof AiSystemStakeholderSchema>;

export const StakeholderMapSchema = z.object({
  aiSystemId: UuidSchema,
  stakeholders: z.array(AiSystemStakeholderSchema),
  generatedAt: z.string().datetime(),
});
export type StakeholderMap = z.infer<typeof StakeholderMapSchema>;
