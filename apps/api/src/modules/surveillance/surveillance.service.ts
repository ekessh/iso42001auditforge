// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateSurveillanceDto, UpdateSurveillanceDto, SurveillanceDto } from './dto.js';
import { SurveillanceRepository } from './surveillance.repository.js';

@Injectable()
export class SurveillanceService {
  constructor(private readonly repo: SurveillanceRepository) {}

  create(firmId: string, dto: CreateSurveillanceDto): Promise<SurveillanceDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<SurveillanceDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: SurveillanceDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateSurveillanceDto): Promise<SurveillanceDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
