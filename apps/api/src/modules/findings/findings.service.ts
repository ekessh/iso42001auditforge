// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors.js';
import type { CreateFindingDto, FindingDto, UpdateFindingDto } from './dto.js';
import { FindingsRepository } from './findings.repository.js';

const TRANSITIONS: Record<string, readonly string[]> = {
  open: ['capa_pending', 'closed'],
  capa_pending: ['capa_in_progress', 'closed'],
  capa_in_progress: ['closed'],
  closed: ['verified'],
  verified: [],
};

@Injectable()
export class FindingsService {
  constructor(private readonly repo: FindingsRepository) {}

  create(firmId: string, dto: CreateFindingDto): Promise<FindingDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<FindingDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateFindingDto): Promise<FindingDto> { return this.repo.update(firmId, id, dto); }

  async transition(firmId: string, id: string, to: FindingDto['status']): Promise<FindingDto> {
    const cur = await this.repo.findById(firmId, id);
    const allowed = TRANSITIONS[cur.status] ?? [];
    if (!allowed.includes(to)) throw new ConflictError(`Cannot transition finding from ${cur.status} to ${to}`);
    return this.repo.setStatus(firmId, id, to);
  }
}
