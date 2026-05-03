// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateAuditPlansDto, UpdateAuditPlansDto, AuditPlansDto } from './dto.js';
import { AuditPlansRepository } from './audit-plans.repository.js';

@Injectable()
export class AuditPlansService {
  constructor(private readonly repo: AuditPlansRepository) {}

  create(firmId: string, dto: CreateAuditPlansDto): Promise<AuditPlansDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<AuditPlansDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: AuditPlansDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateAuditPlansDto): Promise<AuditPlansDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
