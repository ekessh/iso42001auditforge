// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const LibraryEntryKindSchema = z.enum([
  'iso42001_clause',
  'annex_a_control',
  'eu_ai_act_article',
  'nist_ai_rmf',
  'owasp_llm',
  'mitre_atlas',
  'avid',
  'mit_air',
  'question',
]);
export type LibraryEntryKind = z.infer<typeof LibraryEntryKindSchema>;

/**
 * UI-facing kind filter alias (per the api-client query). Maps to the
 * concrete `LibraryEntryKind` set above:
 *   question         -> question
 *   clause           -> iso42001_clause
 *   probe            -> probe (synthetic â€” exposed via probe-engine descriptor)
 *   control-mapping  -> annex_a_control + framework_mappings
 */
export const LibraryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  kind: z.union([LibraryEntryKindSchema, z.enum(['clause', 'probe', 'control-mapping'])]).optional(),
  q: z.string().max(1000).optional(),
});
export type LibraryQueryDto = z.infer<typeof LibraryQuerySchema>;

export class LibraryEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      'iso42001_clause',
      'annex_a_control',
      'eu_ai_act_article',
      'nist_ai_rmf',
      'owasp_llm',
      'mitre_atlas',
      'avid',
      'mit_air',
      'question',
    ],
  })
  kind!: LibraryEntryKind;
  @ApiProperty() ref!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ required: false }) body?: string;
  @ApiProperty({ type: [String] }) tags!: string[];
}

export class LibraryPageDto {
  @ApiProperty({ type: [LibraryEntryDto] }) items!: LibraryEntryDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
