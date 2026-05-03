// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreatePeerReviewDto, UpdatePeerReviewDto, PeerReviewDto } from './dto.js';
import { PeerReviewRepository } from './peer-review.repository.js';
import { PeerReviewAdapter } from '../../adapters/peer-review.adapter.js';

@Injectable()
export class PeerReviewService {
  constructor(
    private readonly repo: PeerReviewRepository,
    @Optional() @Inject(PeerReviewAdapter) private readonly adapter?: PeerReviewAdapter,
  ) {}

  create(firmId: string, dto: CreatePeerReviewDto): Promise<PeerReviewDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<PeerReviewDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: PeerReviewDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdatePeerReviewDto): Promise<PeerReviewDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to peer-review workflow + checklist registry + scoring. */
  workflow(): PeerReviewAdapter | null {
    return this.adapter ?? null;
  }
}
