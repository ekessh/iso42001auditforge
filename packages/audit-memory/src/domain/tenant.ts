// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema } from '@auditforge/shared';

export const EngagementContextSchema = z.object({
  firmId: UuidSchema,
  engagementId: UuidSchema,
  auditorId: UuidSchema.optional(),
});
export type EngagementContext = z.infer<typeof EngagementContextSchema>;
