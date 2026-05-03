// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const ProbeMode = z.enum(['offline', 'live', 'replay']);

export const CreateProbeDefinitionSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(64),
  mode: ProbeMode,
  spec: z.record(z.unknown()),
  budgetUsd: z.number().nonnegative().default(0),
  cpuMs: z.number().int().positive().max(15 * 60 * 1000).default(60_000),
  memMb: z.number().int().positive().max(8192).default(512),
});
export type CreateProbeDefinitionDto = z.infer<typeof CreateProbeDefinitionSchema>;

export const ExecuteProbeSchema = z.object({
  engagementId: z.string().uuid(),
  aiSystemId: z.string().uuid().optional(),
  testSetId: z.string().uuid().optional(),
  parameters: z.record(z.unknown()).default({}),
});
export type ExecuteProbeDto = z.infer<typeof ExecuteProbeSchema>;

export class ProbeDefinitionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: ['offline', 'live', 'replay'] }) mode!: string;
  @ApiProperty({ type: Object }) spec!: Record<string, unknown>;
  @ApiProperty() budgetUsd!: number;
  @ApiProperty() cpuMs!: number;
  @ApiProperty() memMb!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class ProbeExecutionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() probeId!: string;
  @ApiProperty({ enum: ['queued', 'running', 'success', 'failed', 'cancelled', 'budget_exceeded'] }) status!: string;
  @ApiProperty({ required: false }) jobId?: string;
  @ApiProperty({ required: false, type: Object }) result?: Record<string, unknown>;
  @ApiProperty() costUsd!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ required: false, format: 'date-time' }) finishedAt?: string;
}

export class ProbePageDto {
  @ApiProperty({ type: [ProbeDefinitionDto] }) items!: ProbeDefinitionDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}

export class ProbeExecutionPageDto {
  @ApiProperty({ type: [ProbeExecutionDto] }) items!: ProbeExecutionDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
