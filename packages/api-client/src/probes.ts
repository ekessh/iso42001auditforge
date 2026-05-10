// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const ProbeModeSchema = z.enum(['offline', 'live', 'replay']);
export type ProbeMode = z.infer<typeof ProbeModeSchema>;

export const ProbeDefinitionSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  name: z.string(),
  category: z.string(),
  mode: ProbeModeSchema,
  spec: z.record(z.unknown()),
  budgetUsd: z.number().nonnegative(),
  cpuMs: z.number().int().positive(),
  memMb: z.number().int().positive(),
  createdAt: z.string(),
});
export type ProbeDefinition = z.infer<typeof ProbeDefinitionSchema>;

export const ProbeExecutionStatusSchema = z.enum([
  'queued',
  'running',
  'success',
  'failed',
  'cancelled',
  'budget_exceeded',
]);
export type ProbeExecutionStatus = z.infer<typeof ProbeExecutionStatusSchema>;

export const ProbeExecutionSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  engagementId: z.string(),
  probeId: z.string(),
  status: ProbeExecutionStatusSchema,
  jobId: z.string().optional(),
  result: z.record(z.unknown()).optional(),
  costUsd: z.number(),
  createdAt: z.string(),
  finishedAt: z.string().optional(),
});
export type ProbeExecution = z.infer<typeof ProbeExecutionSchema>;

export const ProbePageSchema = PaginatedSchema(ProbeDefinitionSchema);
export const ProbeExecutionPageSchema = PaginatedSchema(ProbeExecutionSchema);

export interface ListProbesParams {
  cursor?: string;
  limit?: number;
}

export function listProbes(params: ListProbesParams = {}, options: ApiFetchOptions = {}) {
  return apiFetch('/probes', ProbePageSchema, {
    ...options,
    query: { cursor: params.cursor, limit: params.limit },
  });
}

export function getProbe(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/probes/${encodeURIComponent(id)}`, ProbeDefinitionSchema, options);
}

export function listProbeExecutions(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/probes/executions', ProbeExecutionPageSchema, {
    ...options,
    query: { engagementId },
  });
}

export const CreateProbeExecutionSchema = z.object({
  engagementId: z.string(),
  probeId: z.string(),
  target: z.string().min(1).max(2000).optional(),
  budgetUsd: z.number().nonnegative().optional(),
  parameters: z.record(z.unknown()).optional(),
});
export type CreateProbeExecutionInput = z.infer<typeof CreateProbeExecutionSchema>;

export function createProbeExecution(
  body: CreateProbeExecutionInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/probes/executions', ProbeExecutionSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
