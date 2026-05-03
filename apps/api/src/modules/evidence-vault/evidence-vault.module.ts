// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { EvidenceVaultAdapter } from '../../adapters/evidence-vault.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { EvidenceController } from './evidence-vault.controller.js';
import { EvidenceRepository } from './evidence-vault.repository.js';
import { EvidenceService } from './evidence-vault.service.js';

@Module({
  controllers: [EvidenceController],
  providers: [
    EvidenceService,
    EvidenceRepository,
    EvidenceVaultAdapter,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [EvidenceService, EvidenceVaultAdapter],
})
export class EvidenceVaultModule {}
