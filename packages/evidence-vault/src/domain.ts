// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const AvScanResult = z.enum(['clean', 'infected', 'pending', 'skipped', 'error']);
export type AvScanResult = z.infer<typeof AvScanResult>;

export const EvidenceObject = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  filename: z.string().min(1).max(512),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sha3_256: z.string().regex(/^[a-f0-9]{64}$/),
  storageKey: z.string().min(1),
  avScanResult: AvScanResult,
  ocrText: z.string().nullable(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.string().datetime(),
  retainUntil: z.string().datetime(),
});
export type EvidenceObject = z.infer<typeof EvidenceObject>;

export const EvidenceLinkTarget = z.enum([
  'working_paper',
  'finding',
  'sample',
  'probe_execution',
  'agent_trace',
  'interview',
]);
export type EvidenceLinkTarget = z.infer<typeof EvidenceLinkTarget>;

export const EvidenceLink = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
  targetType: EvidenceLinkTarget,
  targetId: z.string().uuid(),
  linkedBy: z.string().uuid(),
  linkedAt: z.string().datetime(),
});
export type EvidenceLink = z.infer<typeof EvidenceLink>;

export const SignedUrlGrant = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
  scope: z.enum(['read', 'head']),
  expiresAt: z.string().datetime(),
  singleUse: z.boolean(),
  consumed: z.boolean(),
  issuedBy: z.string().uuid(),
  issuedAt: z.string().datetime(),
});
export type SignedUrlGrant = z.infer<typeof SignedUrlGrant>;
