// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';

export class IdParamDto {
  @ApiProperty({ format: 'uuid', example: '7f1c1c14-3a1d-4e6e-9c1e-2a7e1f4cb2a1' })
  id!: string;
}

export class PageMetaDto {
  @ApiProperty({ nullable: true, example: 'eyJpZCI6Ii4uLiJ9' })
  nextCursor!: string | null;
  @ApiProperty({ nullable: true })
  prevCursor!: string | null;
}

export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://auditforge.dev/errors/not-found' })
  type!: string;
  @ApiProperty({ example: 'Resource not found' })
  title!: string;
  @ApiProperty({ example: 404 })
  status!: number;
  @ApiProperty({ example: 'Engagement abc not found' })
  detail!: string;
  @ApiProperty({ example: '/v1/engagements/abc' })
  instance!: string;
}
