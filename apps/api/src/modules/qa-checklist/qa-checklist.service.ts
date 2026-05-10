// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import {
  ChecklistRunner,
  type ChecklistResult,
  type QaChecklistLedgerEvent,
  type ReportPublicationContext,
} from '@auditforge/qa-checklist';
import type { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Injectable()
export class QaChecklistService {
  private readonly runner: ChecklistRunner;

  constructor(private readonly audit: AuditEngineAdapter) {
    this.runner = new ChecklistRunner({
      ledger: {
        emit: (event: QaChecklistLedgerEvent) => {
          // Fire-and-forget; rejection from concurrent appends is logged
          // internally by AuditEngineAdapter. Persistence guarantees come
          // from the Drizzle migration 0012 sink (qa_checklist_runs).
          void this.audit
            .append({
              firmId: event.firmId,
              engagementId: event.engagementId,
              actorId: event.actorId,
              type: event.kind,
              entity: 'qa-checklist',
              entityId: event.reportId,
              payload: event as unknown as Record<string, unknown>,
            })
            .catch(() => undefined);
        },
      },
    });
  }

  evaluate(args: {
    firmId: string;
    actorId: string;
    ctx: Omit<ReportPublicationContext, 'firmId'>;
  }): ChecklistResult {
    const ctx: ReportPublicationContext = { ...args.ctx, firmId: args.firmId };
    return this.runner.evaluate({ ctx, actorId: args.actorId });
  }
}
