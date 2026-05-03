// SPDX-License-Identifier: BUSL-1.1
//
// Findings adapter — wires `@auditforge/findings` into the API:
//
//   - `FindingRegistry` (CRUD with state machine + ledger emission)
//   - `NumberingService` (default NC/OFI/CONF schemes)
//   - `StateMachine` (issue / accept / dispute / resolve / close / reopen)
//   - `MultiClauseLinker` (catalogue-validated clause + Annex A links)
//
// The adapter also bridges to `@auditforge/capa` for CAPA effectiveness
// follow-ups via the package's exported workflow primitives.
//
// TODO(rls-migration): swap in a Postgres-backed `FindingRegistry` (the
// package's storage interface is already abstracted) once `packages/db`
// exposes the `findings` schema.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  createDefaultStateMachine,
  createFindingRegistry,
  createMultiClauseLinker,
  createNumberingService,
  defaultNumberingSchemes,
  permissiveCatalogue,
  type FindingRegistry,
  type LedgerEmitter as FindingLedgerEmitter,
  type FindingLedgerEnvelope,
  type StateMachine,
  type NumberingService,
} from '@auditforge/findings';
import { AuditEngineAdapter } from './audit-engine.adapter.js';

@Injectable()
export class FindingsAdapter {
  private readonly logger = new Logger(FindingsAdapter.name);

  readonly numbering: NumberingService;
  readonly machine: StateMachine;
  readonly registry: FindingRegistry;

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    this.numbering = createNumberingService(defaultNumberingSchemes());
    this.machine = createDefaultStateMachine();
    // TODO(rls-migration): replace `permissiveCatalogue()` with a wrapper over
    // `@auditforge/catalogues` once that package's runtime catalogue interface
    // stabilizes. Currently keeps backwards-compat with the existing
    // FindingsService that does not pre-validate clauses.
    const linker = createMultiClauseLinker(permissiveCatalogue(), {
      requireAtLeastOneClause: false,
    });
    this.registry = createFindingRegistry({
      numbering: this.numbering,
      machine: this.machine,
      ledger: this.makeLedger(),
      linker,
    });
  }

  private makeLedger(): FindingLedgerEmitter {
    return {
      emit: (envelope: FindingLedgerEnvelope): void => {
        // Fire and forget; logging on error keeps the registry write-path
        // synchronous (matches the package's `void` return type).
        void this.audit
          .append({
            firmId: envelope.firmId,
            engagementId: envelope.engagementId,
            actorId: envelope.by,
            type: envelope.kind,
            entity: 'finding',
            entityId: envelope.findingId,
            payload: { ...envelope.payload, at: envelope.at },
          })
          .catch((err: unknown) => this.logger.error({ err }, 'finding ledger emit failed'));
      },
    };
  }
}
