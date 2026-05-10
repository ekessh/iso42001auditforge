// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';

export class AnnexFamilyDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() readinessPct!: number;
  @ApiProperty() evidenced!: number;
  @ApiProperty() partial!: number;
  @ApiProperty() untouched!: number;
  @ApiProperty() totalClauses!: number;
  @ApiProperty({ enum: ['green', 'amber', 'red', 'grey'] }) status!: 'green' | 'amber' | 'red' | 'grey';
}

export class ReadinessTrendPointDto {
  @ApiProperty() date!: string;
  @ApiProperty() readinessPct!: number;
  @ApiProperty({ required: false }) event?: string;
}

export class BlockerDto {
  @ApiProperty() id!: string;
  @ApiProperty() clauseId!: string;
  @ApiProperty() clauseTitle!: string;
  @ApiProperty({ enum: ['high', 'medium', 'low'] }) impact!: 'high' | 'medium' | 'low';
  @ApiProperty() recommendedAction!: string;
}

export class OpenItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['major', 'minor', 'ofi', 'observation'] })
  type!: 'major' | 'minor' | 'ofi' | 'observation';
  @ApiProperty() title!: string;
  @ApiProperty() clauseId!: string;
  @ApiProperty() age!: string;
}

export class ReadinessAiSystemBarDto {
  @ApiProperty() systemId!: string;
  @ApiProperty() systemName!: string;
  @ApiProperty() readinessPct!: number;
  @ApiProperty() weight!: number;
}

export class WeightsDto {
  @ApiProperty() mandatory!: number;
  @ApiProperty() annexA!: number;
  @ApiProperty() description!: string;
}

export class ReadinessDto {
  @ApiProperty() overallPct!: number;
  @ApiProperty() trend30dDelta!: number;
  @ApiProperty() trend90dDelta!: number;
  @ApiProperty() targetCertDate!: string;
  @ApiProperty() daysToTarget!: number;
  @ApiProperty({ type: [AnnexFamilyDto] }) families!: AnnexFamilyDto[];
  @ApiProperty({ type: [ReadinessTrendPointDto] }) trend!: ReadinessTrendPointDto[];
  @ApiProperty({ type: [BlockerDto] }) blockers!: BlockerDto[];
  @ApiProperty({ type: [OpenItemDto] }) openItems!: OpenItemDto[];
  @ApiProperty({ type: [ReadinessAiSystemBarDto] }) aiSystems!: ReadinessAiSystemBarDto[];
  @ApiProperty({ type: WeightsDto }) weights!: WeightsDto;
  /** Mandatory non-certification disclaimer (CLAUDE.md Termination Semantics). */
  @ApiProperty() mode!: 'readiness';
  @ApiProperty() disclaimer!: string;
}

export const READINESS_DISCLAIMER =
  'This is a Readiness Mode self-assessment using ISO/IEC 42001 as a reference framework. ' +
  'It does NOT constitute a certification, accreditation, or formal conformity audit. ' +
  'Output uses "appears ready" language; only a Lead Auditor in Audit Mode can conclude conformity.';
