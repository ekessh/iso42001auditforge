// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence-vault.controller.js';
import { EvidenceRepository } from './evidence-vault.repository.js';
import { EvidenceService } from './evidence-vault.service.js';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService, EvidenceRepository],
  exports: [EvidenceService],
})
export class EvidenceVaultModule {}
