// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';

export class CoverageCellDto {
  @ApiProperty() id!: string;
  @ApiProperty({ required: false }) title?: string;
  @ApiProperty({ enum: ['evidenced', 'partial', 'contradicted', 'untouched'] })
  status!: 'evidenced' | 'partial' | 'contradicted' | 'untouched';
}

export class CoverageAreaDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [CoverageCellDto] }) cells!: CoverageCellDto[];
}
