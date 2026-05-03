// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const EngagementStage = z.enum(['stage1', 'stage2', 'surveillance', 'recertification', 'special']);
export const EngagementStatus = z.enum(['planned', 'in_progress', 'reporting', 'reviewed', 'issued', 'archived', 'cancelled']);

/**
 * ADR-0013: Engagement mode (audit vs readiness). Required at creation and
 * immutable thereafter — the service layer enforces immutability and maps
 * any attempt to change `mode` to RFC 7807 / HTTP 409 Conflict.
 */
export const EngagementMode = z.enum(['audit', 'readiness']);
export type EngagementModeDto = z.infer<typeof EngagementMode>;

export const CreateEngagementSchema = z.object({
  clientId: z.string().uuid(),
  mode: EngagementMode,
  stage: EngagementStage,
  scopeStatement: z.string().min(1).max(4000),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  leadAuditorId: z.string().uuid(),
  teamMemberIds: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateEngagementDto = z.infer<typeof CreateEngagementSchema>;

/**
 * Update DTO compile-time excludes `mode` (immutable per ADR-0013). The
 * service layer additionally enforces a runtime guard so an untyped JSON
 * body cannot smuggle a `mode` field past the validator.
 */
export const UpdateEngagementSchema = CreateEngagementSchema
  .omit({ mode: true })
  .partial()
  // Strict so unknown keys (notably an attempt to set `mode`) are rejected
  // at the validation boundary with a 400 — defence in depth alongside the
  // service-layer 409.
  .strict();
export type UpdateEngagementDto = z.infer<typeof UpdateEngagementSchema>;

export const TransitionEngagementSchema = z.object({
  to: EngagementStatus,
  reason: z.string().min(1).max(2000).optional(),
});
export type TransitionEngagementDto = z.infer<typeof TransitionEngagementSchema>;

export class EngagementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty({
    enum: ['audit', 'readiness'],
    description:
      'Engagement mode (ADR-0013). Immutable after creation. `audit` = formal conformity audit; `readiness` = self-assessment using ISO/IEC 42001 as a reference framework (NOT a certification).',
  })
  mode!: EngagementModeDto;
  @ApiProperty({ enum: ['stage1', 'stage2', 'surveillance', 'recertification', 'special'] }) stage!: string;
  @ApiProperty({ enum: ['planned', 'in_progress', 'reporting', 'reviewed', 'issued', 'archived', 'cancelled'] }) status!: string;
  @ApiProperty() scopeStatement!: string;
  @ApiProperty({ format: 'date' }) startsOn!: string;
  @ApiProperty({ format: 'date' }) endsOn!: string;
  @ApiProperty() leadAuditorId!: string;
  @ApiProperty({ type: [String] }) teamMemberIds!: string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
}

export class EngagementPageDto {
  @ApiProperty({ type: [EngagementDto] }) items!: EngagementDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
