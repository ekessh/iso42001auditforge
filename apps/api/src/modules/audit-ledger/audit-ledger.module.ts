// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { AuditLedgerController } from './audit-ledger.controller.js';
import { AuditLedgerService } from './audit-ledger.service.js';

@Module({
  controllers: [AuditLedgerController],
  providers: [AuditLedgerService, AuditEngineAdapter],
  exports: [AuditLedgerService, AuditEngineAdapter],
})
export class AuditLedgerModule {}
