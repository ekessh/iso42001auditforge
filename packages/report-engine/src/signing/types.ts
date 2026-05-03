// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { IsoDateSchema, NonEmptyStringSchema, Sha256HexSchema, UuidSchema } from '@auditforge/shared';

/**
 * Roles per ADR-0006: lead auditor + (optional) peer reviewer + technical
 * expert. Multi-signer policies enumerate the roles required and (optionally)
 * the order they must commit in.
 */
export const SignerRoleSchema = z.enum([
  'lead_auditor',
  'peer_reviewer',
  'technical_expert',
]);
export type SignerRole = z.infer<typeof SignerRoleSchema>;

export const SignatureFormatSchema = z.enum(['CAdES-LT', 'PAdES-LTV']);
export type SignatureFormat = z.infer<typeof SignatureFormatSchema>;

export const HardwareKeyKindSchema = z.enum([
  'webauthn',
  'passkey',
  'pkcs11',
  'software-test', // explicitly marked: test/non-prod only
]);
export type HardwareKeyKind = z.infer<typeof HardwareKeyKindSchema>;

/** A request emitted by the engine for a host to sign with a hardware key. */
export const SignatureRequestSchema = z.object({
  id: UuidSchema,
  /** SHA-256 of the canonical bytes the signer is committing to. */
  digest: Sha256HexSchema,
  /** What format the final embedding will use. */
  format: SignatureFormatSchema,
  /** Suggested hardware backend (host may swap, but must record what it used). */
  preferredKey: HardwareKeyKindSchema,
  /** Role of the signer who must commit this request. */
  role: SignerRoleSchema,
  /** Free-form metadata: TSA URL, reason, location, contact info. */
  meta: z.object({
    reason: z.string().optional(),
    location: z.string().optional(),
    contactInfo: z.string().optional(),
    tsaUrl: z.string().url().optional(),
  }),
});
export type SignatureRequest = z.infer<typeof SignatureRequestSchema>;

/** Opaque hardware-produced response. Engine never sees private keys. */
export const SignatureResponseSchema = z.object({
  requestId: UuidSchema,
  /** Hex-encoded signature bytes (e.g. ECDSA-SHA256 or RSA-PSS). */
  signatureHex: z.string().regex(/^[0-9a-f]+$/),
  /** Hex-encoded DER public-key cert chain (leaf -> root). */
  certChainHex: z.array(z.string().regex(/^[0-9a-f]+$/)).min(1),
  /** Algorithm OID (e.g. 1.2.840.10045.4.3.2 for ecdsa-with-SHA256). */
  algorithmOid: NonEmptyStringSchema,
  /** Key kind actually used (host may downgrade with consent). */
  hardwareKey: HardwareKeyKindSchema,
  /** When the signer's device produced the bytes. */
  signedAt: IsoDateSchema,
});
export type SignatureResponse = z.infer<typeof SignatureResponseSchema>;

/** RFC 3161 timestamp token, embedded for long-term validation. */
export const TsaTokenSchema = z.object({
  /** Hex-encoded RFC 3161 TSTInfo + signed token. */
  tokenHex: z.string().regex(/^[0-9a-f]+$/),
  /** TSA URL (recorded for traceability). */
  tsaUrl: z.string().url(),
  /** When the TSA's clock said the token was issued. */
  issuedAt: IsoDateSchema,
  /** Hex-encoded TSA cert chain. */
  tsaCertChainHex: z.array(z.string().regex(/^[0-9a-f]+$/)).min(1),
});
export type TsaToken = z.infer<typeof TsaTokenSchema>;

/** A committed signature: response + TSA token + role. */
export const CommittedSignatureSchema = z.object({
  request: SignatureRequestSchema,
  response: SignatureResponseSchema,
  tsaToken: TsaTokenSchema,
});
export type CommittedSignature = z.infer<typeof CommittedSignatureSchema>;

/**
 * The signed manifest embedded alongside the artifact bytes. CAdES-LT puts
 * this in a side-car; PAdES-LTV embeds it in the PDF /ByteRange. We carry
 * this structure regardless of envelope.
 */
export const SignedManifestSchema = z.object({
  version: z.literal(1),
  format: SignatureFormatSchema,
  /** SHA-256 of the bytes that were signed (the artifact). */
  artifactDigest: Sha256HexSchema,
  /** All committed signatures; verification is order-independent. */
  signatures: z.array(CommittedSignatureSchema).min(1),
  /** Validation material: cached CRLs/OCSP responses for LTV. */
  ltv: z.object({
    crls: z.array(z.string().regex(/^[0-9a-f]+$/)),
    ocspResponses: z.array(z.string().regex(/^[0-9a-f]+$/)),
    // The list of hex DER certs collected from chains (for archive).
    certs: z.array(z.string().regex(/^[0-9a-f]+$/)),
    /**
     * Last time LTV material was refreshed. The renewal job re-fetches
     * TSA tokens before this + RENEW_WINDOW expires.
     */
    refreshedAt: IsoDateSchema,
  }),
});
export type SignedManifest = z.infer<typeof SignedManifestSchema>;

/**
 * Multi-signer policy. `requiredRoles` lists the roles that must commit;
 * `enforceOrder=true` requires them in the listed order, otherwise any order.
 * Ordering checks are independent of the *commit* order — verifications are
 * always order-independent.
 */
export const SignerPolicySchema = z.object({
  requiredRoles: z.array(SignerRoleSchema).min(1),
  enforceOrder: z.boolean().default(false),
  format: SignatureFormatSchema,
});
export type SignerPolicy = z.infer<typeof SignerPolicySchema>;
