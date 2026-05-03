// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const ArchiveStatus = z.enum(['active', 'renewing', 'retired']);
export type ArchiveStatus = z.infer<typeof ArchiveStatus>;

export const SignatureRecord = z.object({
  signerId: z.string().uuid(),
  signerRole: z.enum(['lead_auditor', 'peer_reviewer', 'technical_expert']),
  algorithm: z.string(),
  signedAt: z.string().datetime(),
  signatureBase64: z.string(),
  certificateChain: z.array(z.string()).optional(),
});
export type SignatureRecord = z.infer<typeof SignatureRecord>;

export const TsaToken = z.object({
  authority: z.string(),
  issuedAt: z.string().datetime(),
  tokenBase64: z.string(),
});
export type TsaToken = z.infer<typeof TsaToken>;

export const AuditFileArchive = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  frozenAt: z.string().datetime(),
  bundleManifestKey: z.string(),
  merkleRoot: z.string().regex(/^[a-f0-9]{64}$/),
  signatures: z.array(SignatureRecord).min(1),
  tsaTokens: z.array(TsaToken).min(1),
  retainUntil: z.string().datetime(),
  status: ArchiveStatus,
});
export type AuditFileArchive = z.infer<typeof AuditFileArchive>;

export const AccessGrant = z.object({
  id: z.string().uuid(),
  archiveId: z.string().uuid(),
  granteeId: z.string().uuid(),
  granteeRole: z.literal('accreditation_auditor'),
  scope: z.array(z.enum(['working_papers', 'findings', 'reports', 'ledger', 'evidence'])),
  expiresAt: z.string().datetime(),
  issuedBy: z.string().uuid(),
  issuedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
});
export type AccessGrant = z.infer<typeof AccessGrant>;
