// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';

export const QaChecklistLedgerEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('qa_checklist.evaluated'),
    firmId: UuidSchema,
    engagementId: UuidSchema,
    reportId: UuidSchema,
    passed: z.boolean(),
    failedItemIds: z.array(NonEmptyStringSchema).default([]),
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('qa_checklist.overridden'),
    firmId: UuidSchema,
    engagementId: UuidSchema,
    reportId: UuidSchema,
    itemId: NonEmptyStringSchema,
    rationale: NonEmptyStringSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
]);
export type QaChecklistLedgerEvent = z.infer<typeof QaChecklistLedgerEventSchema>;
