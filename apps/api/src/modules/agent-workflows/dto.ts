// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateAgentWorkflowsSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateAgentWorkflowsDto = z.infer<typeof CreateAgentWorkflowsSchema>;

export const UpdateAgentWorkflowsSchema = CreateAgentWorkflowsSchema.partial();
export type UpdateAgentWorkflowsDto = z.infer<typeof UpdateAgentWorkflowsSchema>;

export class AgentWorkflowsDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AgentWorkflowsPageDto {
  @ApiProperty({ type: [AgentWorkflowsDto] }) items!: AgentWorkflowsDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
