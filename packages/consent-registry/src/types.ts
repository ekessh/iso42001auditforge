// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const CLOUD_PROVIDERS = ['anthropic', 'openai'] as const;
export type CloudProviderName = (typeof CLOUD_PROVIDERS)[number];

export const ConsentScopeSchema = z
  .object({
    purposes: z.array(z.string().min(1)).min(1),
    dataClassesPermitted: z.array(z.string().min(1)),
    redactionRequired: z.boolean().default(true),
    notes: z.string().default(''),
  })
  .strict();
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

export const ConsentRecordSchema = z
  .object({
    id: z.string().uuid(),
    firmId: z.string().uuid(),
    engagementId: z.string().uuid(),
    grantedBy: z.string().uuid(),
    grantedAt: z.string().min(1),
    revokedAt: z.string().min(1).nullable(),
    expiresAt: z.string().min(1).nullable(),
    providers: z.array(z.string().min(1)).min(1),
    purpose: z.string().min(1),
    scope: ConsentScopeSchema,
    writtenConsentDocId: z.string().min(1).nullable(),
  })
  .strict();
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export interface ConsentLookup {
  engagementId: string;
  providerName: string;
  now?: Date;
}
