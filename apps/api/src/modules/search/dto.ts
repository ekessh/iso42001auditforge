// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const SearchScopeSchema = z.enum([
  'all',
  'questions',
  'clauses',
  'probes',
  'evidence',
  'traces',
  'findings',
  'working_papers',
  'catalogues',
]);
export type SearchScopeDto = z.infer<typeof SearchScopeSchema>;

export const SearchRequestSchema = z.object({
  q: z.string().min(1).max(2000),
  scope: SearchScopeSchema.default('all'),
  filters: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  k: z.number().int().positive().max(200).default(20),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export class SearchHitDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  scope!: SearchScopeDto;
  @ApiProperty()
  score!: number;
  @ApiProperty({ required: false })
  bm25Score?: number;
  @ApiProperty({ required: false })
  vectorScore?: number;
  @ApiProperty({ required: false })
  snippet?: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
}

export class SearchResponseDto {
  @ApiProperty({ type: () => [SearchHitDto] })
  hits!: SearchHitDto[];
  @ApiProperty()
  totalEstimated!: number;
  @ApiProperty()
  tookMs!: number;
  @ApiProperty({ type: [String] })
  modes!: ReadonlyArray<'keyword' | 'semantic' | 'hybrid'>;
}
