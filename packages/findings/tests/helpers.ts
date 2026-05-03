// SPDX-License-Identifier: BUSL-1.1
/**
 * Shared test fixtures + builders for the findings package.
 */
import { brandedFromUuid } from '@auditforge/shared';
import type {
  AuditEventId,
  AuditorId,
  ClientId,
  EngagementId,
  EvidenceId,
  FindingId,
  FirmId,
} from '@auditforge/shared';
import {
  createDefaultStateMachine,
  createFindingRegistry,
  createMultiClauseLinker,
  createNumberingService,
  defaultNumberingSchemes,
  fixedCatalogue,
  inMemoryLedger,
  permissiveCatalogue,
  type CreateFindingInput,
  type FindingRegistry,
  type StateMachine,
  type NumberingService,
  type InMemoryLedger,
  type MultiClauseLinker,
} from '../src/index.js';

let counter = 0;
function uuid(): string {
  counter += 1;
  // Predictable v4-shaped UUID.
  const seq = counter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${seq}`;
}

export function nextFirmId(): FirmId {
  return brandedFromUuid<'FirmId'>(uuid());
}
export function nextClientId(): ClientId {
  return brandedFromUuid<'ClientId'>(uuid());
}
export function nextEngagementId(): EngagementId {
  return brandedFromUuid<'EngagementId'>(uuid());
}
export function nextAuditEventId(): AuditEventId {
  return brandedFromUuid<'AuditEventId'>(uuid());
}
export function nextAuditorId(): AuditorId {
  return brandedFromUuid<'AuditorId'>(uuid());
}
export function nextEvidenceId(): EvidenceId {
  return brandedFromUuid<'EvidenceId'>(uuid());
}
export function nextFindingId(): FindingId {
  return brandedFromUuid<'FindingId'>(uuid());
}

export function resetCounter(): void {
  counter = 0;
}

export interface TestRig {
  readonly registry: FindingRegistry;
  readonly machine: StateMachine;
  readonly numbering: NumberingService;
  readonly linker: MultiClauseLinker;
  readonly ledger: InMemoryLedger;
  readonly firmId: FirmId;
  readonly clientId: ClientId;
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly auditorId: AuditorId;
}

export interface TestRigOptions {
  readonly clock?: () => string;
  readonly schemes?: ReturnType<typeof defaultNumberingSchemes>;
  readonly strictCatalogue?: boolean;
}

export function buildTestRig(options: TestRigOptions = {}): TestRig {
  const ledger = inMemoryLedger();
  const machine = createDefaultStateMachine();
  const numbering = createNumberingService(
    options.schemes ?? defaultNumberingSchemes(),
  );
  const linker = options.strictCatalogue
    ? createMultiClauseLinker(
        fixedCatalogue({
          clauses: new Map([
            ['ISO_42001', new Set(['4.1', '6.1.2', '8.2'])],
          ]),
          controls: new Set(['A.5.4', 'A.6.2.4', 'A.7.2']),
        }),
      )
    : createMultiClauseLinker(permissiveCatalogue());

  const registry = createFindingRegistry({
    numbering,
    machine,
    ledger,
    linker,
    ...(options.clock ? { clock: options.clock } : {}),
  });

  return {
    registry,
    machine,
    numbering,
    linker,
    ledger,
    firmId: nextFirmId(),
    clientId: nextClientId(),
    engagementId: nextEngagementId(),
    auditEventId: nextAuditEventId(),
    auditorId: nextAuditorId(),
  };
}

export function makeCreateInput(
  overrides: Partial<CreateFindingInput> & {
    readonly firmId: FirmId;
    readonly clientId: ClientId;
    readonly engagementId: EngagementId;
    readonly auditEventId: AuditEventId;
    readonly raisedBy: AuditorId;
  },
): CreateFindingInput {
  return {
    type: 'minor_nc',
    clauseLinks: [{ framework: 'ISO_42001', clauseId: '6.1.2' }],
    controlLinks: [{ controlId: 'A.5.4' }],
    evidenceLinks: [],
    requirementText: 'AI risk treatment plan must be documented',
    statementText: 'No documented treatment plan was found',
    rootCausePromptResponse: 'Process owner unaware of requirement',
    severity: 'medium',
    riskRating: 3,
    topicTags: ['risk-treatment'],
    ...overrides,
  };
}
