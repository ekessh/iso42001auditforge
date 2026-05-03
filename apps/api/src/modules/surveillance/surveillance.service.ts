// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateSurveillanceDto, UpdateSurveillanceDto, SurveillanceDto } from './dto.js';
import { SurveillanceRepository } from './surveillance.repository.js';
import { SurveillanceAdapter } from '../../adapters/surveillance.adapter.js';

@Injectable()
export class SurveillanceService {
  constructor(
    private readonly repo: SurveillanceRepository,
    @Optional() @Inject(SurveillanceAdapter) private readonly adapter?: SurveillanceAdapter,
  ) {}

  create(firmId: string, dto: CreateSurveillanceDto): Promise<SurveillanceDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<SurveillanceDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: SurveillanceDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateSurveillanceDto): Promise<SurveillanceDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to telemetry ingest + threshold + risk-score + scope adjuster. */
  monitoring(): SurveillanceAdapter | null {
    return this.adapter ?? null;
  }
}
