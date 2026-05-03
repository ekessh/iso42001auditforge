// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditLedgerController } from './audit-ledger.controller.js';
import { AuditLedgerService } from './audit-ledger.service.js';

@Module({
  controllers: [AuditLedgerController],
  providers: [AuditLedgerService],
  exports: [AuditLedgerService],
})
export class AuditLedgerModule {}
