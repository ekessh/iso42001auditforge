// SPDX-License-Identifier: BUSL-1.1
/**
 * Wire types for browser RUM. Mirrors `@auditforge/observability/web-vitals-types` but lives in
 * the web app so the browser bundle does not import server-only modules.
 */
import { z } from 'zod';

export const WEB_VITAL_NAMES = ['CLS', 'LCP', 'INP', 'FID', 'TTFB', 'FCP'] as const;
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];

const isoTimestamp = z
  .string()
  .min(20)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid ISO-8601 timestamp' });

export const webVitalSampleSchema = z
  .object({
    name: z.enum(WEB_VITAL_NAMES),
    value: z.number().finite().nonnegative(),
    rating: z.enum(['good', 'needs-improvement', 'poor']),
    id: z.string().min(1).max(128),
    navigationType: z.string().min(1).max(64).optional(),
    pageUrl: z.string().min(1).max(2048),
    pagePath: z.string().min(1).max(1024),
    sessionId: z.string().min(1).max(128).optional(),
    traceId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
    spanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
    occurredAt: isoTimestamp,
    userAgent: z.string().max(512).optional(),
  })
  .strict();

export type WebVitalSample = z.infer<typeof webVitalSampleSchema>;

export const webVitalsBatchSchema = z
  .object({ samples: z.array(webVitalSampleSchema).min(1).max(64) })
  .strict();

export type WebVitalsBatch = z.infer<typeof webVitalsBatchSchema>;

export const observabilityErrorSchema = z
  .object({
    message: z.string().min(1).max(2048),
    name: z.string().min(1).max(128).optional(),
    stack: z.string().max(8192).optional(),
    pageUrl: z.string().min(1).max(2048),
    pagePath: z.string().min(1).max(1024),
    sessionId: z.string().min(1).max(128).optional(),
    traceId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
    spanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
    occurredAt: isoTimestamp,
    severity: z.enum(['warn', 'error', 'fatal']).default('error'),
    userAgent: z.string().max(512).optional(),
    componentStack: z.string().max(8192).optional(),
  })
  .strict();

export type ObservabilityErrorReport = z.infer<typeof observabilityErrorSchema>;

export const observabilityErrorsBatchSchema = z
  .object({ errors: z.array(observabilityErrorSchema).min(1).max(32) })
  .strict();

export type ObservabilityErrorsBatch = z.infer<typeof observabilityErrorsBatchSchema>;
