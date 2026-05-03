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

const VALID_MODES = new Set<string>(['audit', 'readiness']);

/**
 * Reject any update payload that carries `mode` (ADR-0013 — mode is
 * immutable after creation). Mapped to RFC 7807 / HTTP 409 Conflict via
 * `ConflictError`. The Zod `UpdateEngagementSchema` is `.strict()` so this
 * is a defence-in-depth check for any caller that bypasses the pipe.
 */
function assertNoModeChange(dto: UpdateEngagementDto, current: EngagementDto): void {
  const incoming = dto as { mode?: string };
  if (Object.prototype.hasOwnProperty.call(incoming, 'mode') && incoming.mode !== undefined) {
    if (incoming.mode !== current.mode) {
      throw new ConflictError(
        `Engagement mode is immutable after creation: cannot change ${current.mode} -> ${incoming.mode}`,
        {
          code: 'MODE_IMMUTABLE',
          engagementId: current.id,
          fromMode: current.mode,
          toMode: incoming.mode,
        },
      );
    }
  }
}

@Injectable()
export class EngagementsService {
  constructor(private readonly repo: EngagementsRepository) {}

  create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    if (new Date(dto.endsOn) < new Date(dto.startsOn)) {
      throw new ConflictError('endsOn must be on or after startsOn');
    }
    // ADR-0013: mode is required at creation. The Zod pipe enforces this
    // at the controller boundary; the assertion here is defence-in-depth
    // for any non-HTTP caller.
    if (!dto.mode || !VALID_MODES.has(dto.mode)) {
      throw new ConflictError('Engagement mode must be one of [audit, readiness]', {
        code: 'INVALID_MODE',
        receivedMode: dto.mode ?? null,
      });
    }
    return this.repo.create(firmId, dto);
  }

  get(firmId: string, id: string): Promise<EngagementDto> {
    return this.repo.findById(firmId, id);
  }

  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }

  async update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    const current = await this.repo.findById(firmId, id);
    assertNoModeChange(dto, current);
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
