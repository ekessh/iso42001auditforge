// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';

export class FindingTypeBreakdownDto {
  @ApiProperty() major!: number;
  @ApiProperty() minor!: number;
  @ApiProperty() ofi!: number;
  @ApiProperty() observation!: number;
}

export class AreaCoverageBarDto {
  @ApiProperty() areaId!: string;
  @ApiProperty() areaTitle!: string;
  @ApiProperty() planned!: number;
  @ApiProperty() covered!: number;
}

export class ManDayPointDto {
  @ApiProperty() day!: number;
  @ApiProperty() planned!: number;
  @ApiProperty() actual!: number;
}

export class AttentionAreaDto {
  @ApiProperty() areaId!: string;
  @ApiProperty() reason!: string;
}

export class AuditDashboardDto {
  @ApiProperty() coveragePct!: number;
  @ApiProperty({ type: [AreaCoverageBarDto] }) areaBars!: AreaCoverageBarDto[];
  @ApiProperty({ type: [ManDayPointDto] }) manDays!: ManDayPointDto[];
  @ApiProperty() manDaysSpent!: number;
  @ApiProperty() manDaysPlanned!: number;
  @ApiProperty({ type: FindingTypeBreakdownDto }) candidateFindings!: FindingTypeBreakdownDto;
  @ApiProperty() promotedFindings!: number;
  @ApiProperty() samplingCompletePct!: number;
  @ApiProperty({ enum: ['on_track', 'coverage_gap', 'time_overrun'] })
  risk!: 'on_track' | 'coverage_gap' | 'time_overrun';
  @ApiProperty({ type: [AttentionAreaDto] }) attentionAreas!: AttentionAreaDto[];
}
