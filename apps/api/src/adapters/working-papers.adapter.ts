// SPDX-License-Identifier: BUSL-1.1
//
// Working-papers adapter — wires `@auditforge/working-papers` into the API.
//
// Provides:
//   - `WorkingPaperRegistry` (in-memory CRUD with verdict state machine + ledger)
//   - `TemplateRegistry` (bundled JSON templates loaded at boot)
//   - Verdict transitions (`applyVerdictTransition`)
//
// TODO(rls-migration): swap the in-memory `WorkingPaperRegistry` for a
// Drizzle-backed implementation once `packages/db` exposes the
// `working_papers` schema. The package's verdict state machine and ledger
// emitters are already production-ready.

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  TemplateRegistry,
  WorkingPaperRegistry,
  loadBundledTemplates,
  type WpLedgerEmitter,
  type WpLedgerEvent,
} from '@auditforge/working-papers';
import { AuditEngineAdapter } from './audit-engine.adapter.js';

const PRODUCER = 'apps/api:working-papers';

@Injectable()
export class WorkingPapersAdapter implements OnModuleInit {
  private readonly logger = new Logger(WorkingPapersAdapter.name);

  readonly templates: TemplateRegistry;
  readonly registry: WorkingPaperRegistry;

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    this.templates = new TemplateRegistry();
    this.registry = new WorkingPaperRegistry({ emit: this.makeLedgerEmitter() });
  }

  /**
   * Load bundled templates from disk. The registry is fail-soft — a corrupt
   * template file is logged but does not abort boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      const templates = await loadBundledTemplates();
      this.templates.registerMany(templates);
      this.logger.log(`Loaded ${templates.length} working-paper templates`);
    } catch (err) {
      this.logger.warn(`Failed to load bundled WP templates: ${(err as Error).message}`);
    }
  }

  /**
   * Bridge from the package's WP ledger envelope to the API's audit-engine
   * adapter. Each WP mutation becomes a chain-linked ledger entry.
   */
  private makeLedgerEmitter(): WpLedgerEmitter {
    return async (evt: WpLedgerEvent) => {
      try {
        const { tenant, type, workingPaperId, at, ...payload } = evt;
        await this.audit.append({
          firmId: tenant.firmId,
          ...(tenant.engagementId !== undefined ? { engagementId: tenant.engagementId } : {}),
          actorId: tenant.auditorId ?? 'system',
          type,
          entity: 'working-paper',
          entityId: workingPaperId,
          payload: { ...payload, at },
        });
      } catch (err) {
        // Audit failures must not crash the WP mutation path. Log loudly.
        this.logger.error({ err }, 'wp ledger emit failed');
      }
    };
  }

  /** Convenience: emit a "synthetic" wp.* event without going through the
   *  registry (used by the API service layer when bridging legacy DTO shapes). */
  async emitWp(
    firmId: string,
    auditorId: string | undefined,
    engagementId: string | undefined,
    type: string,
    workingPaperId: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.audit.append({
      firmId,
      ...(engagementId !== undefined ? { engagementId } : {}),
      actorId: auditorId ?? 'system',
      type,
      entity: 'working-paper',
      entityId: workingPaperId,
      payload: { producer: PRODUCER, ...extra },
    });
  }
}
