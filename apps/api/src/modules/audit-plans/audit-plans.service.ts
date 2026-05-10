// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateAuditPlansDto, UpdateAuditPlansDto, AuditPlansDto } from './dto.js';
import type { AuditPlansRepository } from './audit-plans.repository.js';
import { AuditPlansAdapter } from '../../adapters/audit-plans.adapter.js';

@Injectable()
export class AuditPlansService {
  constructor(
    private readonly repo: AuditPlansRepository,
    @Optional() @Inject(AuditPlansAdapter) private readonly adapter?: AuditPlansAdapter,
  ) {}

  create(firmId: string, dto: CreateAuditPlansDto): Promise<AuditPlansDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<AuditPlansDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AuditPlansDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateAuditPlansDto): Promise<AuditPlansDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to plan builder + conflict detector + receipt state machine. */
  plan(): AuditPlansAdapter | null {
    return this.adapter ?? null;
  }
}
