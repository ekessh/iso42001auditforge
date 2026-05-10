// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { EvidenceExtractionController } from './evidence-extraction.controller.js';
import { EvidenceExtractionService } from './evidence-extraction.service.js';

@Module({
  controllers: [EvidenceExtractionController],
  providers: [EvidenceExtractionService, AuditEngineAdapter],
  exports: [EvidenceExtractionService],
})
export class EvidenceExtractionModule {}
