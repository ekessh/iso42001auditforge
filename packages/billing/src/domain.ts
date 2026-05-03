// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const BillableCategory = z.enum([
  'planning', 'doc_review', 'stage1_onsite', 'stage2_onsite', 'stage2_remote',
  'probe_execution', 'trace_review', 'reporting', 'peer_review', 'travel', 'admin',
]);
export type BillableCategory = z.infer<typeof BillableCategory>;

export const TimeEntry = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  auditorId: z.string().uuid(),
  category: BillableCategory,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  minutes: z.number().int().positive(),
  notes: z.string().optional(),
  source: z.enum(['timer', 'manual']),
});
export type TimeEntry = z.infer<typeof TimeEntry>;

export const Expense = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  auditorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  category: z.enum(['travel', 'lodging', 'meals', 'supplies', 'other']),
  description: z.string(),
  receiptEvidenceId: z.string().uuid().nullable(),
  occurredAt: z.string().datetime(),
});
export type Expense = z.infer<typeof Expense>;

export const RateCardEntry = z.object({
  category: BillableCategory,
  hourlyRate: z.number().positive(),
  currency: z.string().length(3),
});
export type RateCardEntry = z.infer<typeof RateCardEntry>;

export const Invoice = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  number: z.string(),
  issuedAt: z.string().datetime(),
  currency: z.string().length(3),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  lines: z.array(z.object({
    description: z.string(),
    quantity: z.number().nonnegative(),
    unitPrice: z.number().nonnegative(),
    amount: z.number().nonnegative(),
  })),
});
export type Invoice = z.infer<typeof Invoice>;
