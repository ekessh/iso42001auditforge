// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { PeerReviewDto, CreatePeerReviewDto, UpdatePeerReviewDto } from './dto.js';
import type { PeerReviewAdapter } from '../../adapters/peer-review.adapter.js';

@Injectable()
export class PeerReviewRepository extends BaseRepository {
  private adapter: PeerReviewAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as PeerReviewAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<PeerReviewAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { PeerReviewAdapter } = await import('../../adapters/peer-review.adapter.js');
    this.adapter = new PeerReviewAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreatePeerReviewDto): Promise<PeerReviewDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<PeerReviewDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: PeerReviewDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdatePeerReviewDto): Promise<PeerReviewDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
