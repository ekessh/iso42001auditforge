// SPDX-License-Identifier: BUSL-1.1
//
// EngagementsService — delegates mode-immutability to the package's
// `EngagementService` (via `EngagementAdapter.assertModeImmutable`). The
// outer status state-machine is kept here because the API uses a different
// status enum than the package's nine-state aggregate (`draft / planned /
// in_progress / awaiting_report / awaiting_decision / closed / suspended /
// withdrawn` — see `@auditforge/engagement` `EngagementStatus`). The
// API-side enum maps to `engagement.status_changed` events through the
// audit-engine adapter for the hash chain.

import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors.js';
import type {
  CreateEngagementDto,
  EngagementDto,
  TransitionEngagementDto,
  UpdateEngagementDto,
} from './dto.js';
import { EngagementsRepository } from './engagements.repository.js';
import { EngagementAdapter } from '../../adapters/engagement.adapter.js';

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

@Injectable()
export class EngagementsService {
  // EngagementAdapter is optional so existing tests that wire the
  // repository directly continue to work. When present, `update()` and
  // `transition()` route through the package's services for ledger
  // emission + mode-immutability enforcement.
  constructor(
    private readonly repo: EngagementsRepository,
    @Inject(EngagementAdapter) private readonly adapter?: EngagementAdapter,
  ) {}

  async create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    if (new Date(dto.endsOn) < new Date(dto.startsOn)) {
      throw new ConflictError('endsOn must be on or after startsOn');
    }
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

  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }

  /**
   * Mode-immutability is enforced inside the repository's `update` (which
   * delegates to `EngagementAdapter.updateEngagement` -> the package's
   * `EngagementService.update`). Wrapping the call in a try/catch lets us
   * preserve the legacy API error code (`MODE_IMMUTABLE`).
   */
  async update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    const current = await this.repo.findById(firmId, id);
    if (this.adapter) {
      try {
        this.adapter.assertModeImmutable(current, dto);
      } catch (e) {
        // Re-raise as the existing API ConflictError so HTTP 409 + RFC 7807
        // shape is unchanged.
        const err = e as { fromMode?: string; toMode?: string } & Error;
        throw new ConflictError(err.message, {
          code: 'MODE_IMMUTABLE',
          engagementId: current.id,
          fromMode: err.fromMode ?? current.mode,
          toMode: err.toMode ?? null,
        });
      }
    } else {
      // Fallback when adapter is not wired (legacy tests).
      const incoming = dto as { mode?: string };
      if (
        Object.prototype.hasOwnProperty.call(incoming, 'mode') &&
        incoming.mode !== undefined &&
        incoming.mode !== current.mode
      ) {
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
    return this.repo.update(firmId, id, dto);
  }

  async transition(
    firmId: string,
    id: string,
    dto: TransitionEngagementDto,
  ): Promise<EngagementDto> {
    const cur = await this.repo.findById(firmId, id);
    const allowed = ALLOWED_TRANSITIONS[cur.status] ?? [];
    if (!allowed.includes(dto.to)) {
      throw new ConflictError(`Cannot transition from ${cur.status} to ${dto.to}`, {
        from: cur.status,
        to: dto.to,
      });
    }
    return this.repo.setStatus(firmId, id, dto.to);
  }
}
