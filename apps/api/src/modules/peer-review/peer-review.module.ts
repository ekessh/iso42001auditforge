// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { PeerReviewController } from './peer-review.controller.js';
import { PeerReviewService } from './peer-review.service.js';
import { PeerReviewRepository } from './peer-review.repository.js';
import { PeerReviewCommentsApiService } from './comments.service.js';
import { PeerReviewAdapter } from '../../adapters/peer-review.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [PeerReviewController],
  providers: [
    PeerReviewService,
    PeerReviewRepository,
    PeerReviewCommentsApiService,
    PeerReviewAdapter,
    AuditEngineAdapter,
  ],
  exports: [PeerReviewService, PeerReviewAdapter, PeerReviewCommentsApiService],
})
export class PeerReviewModule {}
