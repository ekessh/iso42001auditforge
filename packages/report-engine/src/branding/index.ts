// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

/**
 * CB letterhead, theme, header/footer. Hosts pass this to a renderer per CB.
 * Default theme provided so reports remain readable when no brand is set.
 */
export const BrandingSchema = z.object({
  cb: z.object({
    name: NonEmptyStringSchema,
    logoSrc: z.string().optional(),
    address: z.string().optional(),
    registrationNumbers: z.array(z.string()).optional(),
    accreditationBody: z.string().optional(),
    contactEmail: z.string().email().optional(),
  }),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  theme: z.object({
    primaryHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    fontFamily: NonEmptyStringSchema.default('Inter'),
  }),
});
export type Branding = z.infer<typeof BrandingSchema>;

export const DEFAULT_BRANDING: Branding = {
  cb: { name: 'AuditForge Default CB' },
  theme: {
    primaryHex: '#0F172A',
    accentHex: '#2563EB',
    fontFamily: 'Inter',
  },
};

/**
 * Apply branding "overrides on top of defaults", validating the merged
 * object. Useful for CBs that customize only a subset of fields.
 */
export function withBranding(partial: Partial<Branding> | undefined): Branding {
  if (partial === undefined) return DEFAULT_BRANDING;
  const merged: Branding = {
    cb: { ...DEFAULT_BRANDING.cb, ...partial.cb },
    theme: { ...DEFAULT_BRANDING.theme, ...partial.theme },
    ...(partial.headerText !== undefined ? { headerText: partial.headerText } : {}),
    ...(partial.footerText !== undefined ? { footerText: partial.footerText } : {}),
  };
  return BrandingSchema.parse(merged);
}
