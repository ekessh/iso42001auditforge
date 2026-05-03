// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const UuidSchema = z
  .string()
  .uuid({ message: 'must be a valid UUID v1-v5' });

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'must be a valid email address' })
  .max(254);

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const UlidSchema = z
  .string()
  .regex(ULID_RE, { message: 'must be a valid Crockford-base32 ULID' });

export const IsoDateSchema = z.string().refine(
  (s) => {
    const t = Date.parse(s);
    return Number.isFinite(t);
  },
  { message: 'must be an ISO-8601 date-time' },
);

export const NonEmptyStringSchema = z.string().min(1).max(10_000);

export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, { message: 'must be 64 lowercase hex chars' });

export const PositiveIntSchema = z.number().int().positive();
export const NonNegativeIntSchema = z.number().int().nonnegative();

export const TenantContextSchema = z.object({
  firmId: UuidSchema,
  auditorId: UuidSchema.optional(),
  engagementId: UuidSchema.optional(),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/, { message: 'invalid semver' });
