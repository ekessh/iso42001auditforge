// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const ProbeExecutionJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  probeId: z.string().uuid(),
  mode: z.enum(['offline', 'live', 'replay']),
  spec: z.record(z.unknown()),
  parameters: z.record(z.unknown()).default({}),
  aiSystemId: z.string().uuid().optional(),
  testSetId: z.string().uuid().optional(),
  caps: z.object({
    cpuMs: z.number().int().positive(),
    memMb: z.number().int().positive(),
    allowedHosts: z.array(z.string()).default([]),
  }),
});
export type ProbeExecutionJob = z.infer<typeof ProbeExecutionJobSchema>;

export const ProbeExecutionResultSchema = z.object({
  status: z.enum(['success', 'failed', 'budget_exceeded', 'timeout', 'sandbox_violation']),
  metrics: z.record(z.number()).default({}),
  costUsd: z.number().nonnegative().default(0),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});
export type ProbeExecutionResult = z.infer<typeof ProbeExecutionResultSchema>;

export const ProbeBatchJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  probeIds: z.array(z.string().uuid()).min(1),
  parameters: z.record(z.unknown()).default({}),
});
export type ProbeBatchJob = z.infer<typeof ProbeBatchJobSchema>;

export const TraceIngestJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  source: z.enum(['otel', 'langsmith', 'mlflow', 'custom']),
  payload: z.record(z.unknown()),
});
export type TraceIngestJob = z.infer<typeof TraceIngestJobSchema>;

export const EvidenceAvScanJobSchema = z.object({
  firmId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  bucket: z.string(),
  objectKey: z.string(),
});
export type EvidenceAvScanJob = z.infer<typeof EvidenceAvScanJobSchema>;

export const EvidenceOcrJobSchema = z.object({
  firmId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  bucket: z.string(),
  objectKey: z.string(),
});
export type EvidenceOcrJob = z.infer<typeof EvidenceOcrJobSchema>;

export const ReportRenderJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  reportId: z.string().uuid(),
  version: z.number().int().positive(),
});
export type ReportRenderJob = z.infer<typeof ReportRenderJobSchema>;

export const ArchiveFreezeJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  retentionYears: z.number().int().positive().max(20).default(10),
});
export type ArchiveFreezeJob = z.infer<typeof ArchiveFreezeJobSchema>;

export const ArchiveRenewJobSchema = z.object({
  firmId: z.string().uuid(),
  archiveId: z.string().uuid(),
});
export type ArchiveRenewJob = z.infer<typeof ArchiveRenewJobSchema>;

export const TelemetryRollupJobSchema = z.object({
  firmId: z.string().uuid(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});
export type TelemetryRollupJob = z.infer<typeof TelemetryRollupJobSchema>;

export const CoAuditorTaskJobSchema = z.object({
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  prompt: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  modelHint: z.string().optional(),
});
export type CoAuditorTaskJob = z.infer<typeof CoAuditorTaskJobSchema>;
