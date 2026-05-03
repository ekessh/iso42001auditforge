// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateBillingDto, UpdateBillingDto, BillingDto } from './dto.js';
import { BillingRepository } from './billing.repository.js';

@Injectable()
export class BillingService {
  constructor(private readonly repo: BillingRepository) {}

  create(firmId: string, dto: CreateBillingDto): Promise<BillingDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<BillingDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: BillingDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateBillingDto): Promise<BillingDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
