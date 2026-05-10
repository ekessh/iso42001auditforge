// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateTenancyDto, UpdateTenancyDto, TenancyDto } from './dto.js';
import type { TenancyRepository } from './tenancy.repository.js';

@Injectable()
export class TenancyService {
  constructor(private readonly repo: TenancyRepository) {}

  create(firmId: string, dto: CreateTenancyDto): Promise<TenancyDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<TenancyDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: TenancyDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateTenancyDto): Promise<TenancyDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
