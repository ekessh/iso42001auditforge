// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { PeerReviewController } from './peer-review.controller.js';
import { PeerReviewService } from './peer-review.service.js';
import { PeerReviewRepository } from './peer-review.repository.js';

@Module({
  controllers: [PeerReviewController],
  providers: [PeerReviewService, PeerReviewRepository],
  exports: [PeerReviewService],
})
export class PeerReviewModule {}
