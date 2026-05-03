// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors.js';
import type { CreateEngagementDto, EngagementDto, TransitionEngagementDto, UpdateEngagementDto } from './dto.js';
import { EngagementsRepository } from './engagements.repository.js';

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['reporting', 'cancelled'],
  reporting: ['reviewed', 'cancelled'],
  reviewed: ['issued', 'reporting'],
  issued: ['archived'],
  archived: [],
  cancelled: [],
};

@Injectable()
export class EngagementsService {
  constructor(private readonly repo: EngagementsRepository) {}

  create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    if (new Date(dto.endsOn) < new Date(dto.startsOn)) {
      throw new ConflictError('endsOn must be on or after startsOn');
    }
    return this.repo.create(firmId, dto);
  }

  get(firmId: string, id: string): Promise<EngagementDto> {
    return this.repo.findById(firmId, id);
  }

  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }

  update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    return this.repo.update(firmId, id, dto);
  }

  async transition(firmId: string, id: string, dto: TransitionEngagementDto): Promise<EngagementDto> {
    const cur = await this.repo.findById(firmId, id);
    const allowed = ALLOWED_TRANSITIONS[cur.status] ?? [];
    if (!allowed.includes(dto.to)) {
      throw new ConflictError(`Cannot transition from ${cur.status} to ${dto.to}`, { from: cur.status, to: dto.to });
    }
    return this.repo.setStatus(firmId, id, dto.to);
  }
}
