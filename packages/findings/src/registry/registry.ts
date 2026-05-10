// SPDX-License-Identifier: BUSL-1.1
/**
 * FindingRegistry â€” tenant-scoped CRUD with ledger event emission and
 * state-machine-driven transitions.
 *
 * The registry is intentionally storage-agnostic. The default factory
 * returns an in-memory implementation; production wires the same interface
 * to a Postgres-backed store in `@auditforge/db`.
 */
import {
  ConflictError,
  ImmutableViolation,
  NotFoundError,
  TenantViolation,
  type AuditEventId,
  type AuditorId,
  type ClientId,
  type EngagementId,
  type FindingId,
  type FirmId,
  brandedFromUuid,
} from '@auditforge/shared';
import type {
  CreateFindingInput,
  DispositionHistoryEntry,
  Finding,
  FindingStatus,
  SurveillanceCarryForwardLink,
} from '../types/finding.js';
import type { FindingRole } from '../types/roles.js';
import type {
  FindingCarriedForwardPayload,
  FindingCreatedPayload,
  FindingTransitionedPayload,
  LedgerEmitter,
} from '../types/ledger.js';
import type { NumberingService } from '../numbering/service.js';
import type { StateMachine } from '../state-machine/machine.js';
import type { TransitionAction } from '../state-machine/transitions.js';
import type { MultiClauseLinker } from '../linker/linker.js';

export interface TenantContext {
  readonly firmId: FirmId;
  readonly clientId: ClientId;
}

export interface TransitionRequest {
  readonly action: TransitionAction;
  readonly role: FindingRole;
  readonly by: AuditorId;
  readonly note?: string;
}

export interface FindingRegistry {
  create(
    input: CreateFindingInput,
    tenant: TenantContext,
    options?: { readonly engagementCode?: string; readonly clientCode?: string },
  ): Finding;
  get(id: FindingId, tenant: TenantContext): Finding;
  tryGet(id: FindingId, tenant: TenantContext): Finding | undefined;
  listByEngagement(
    engagementId: EngagementId,
    tenant: TenantContext,
  ): readonly Finding[];
  listByAuditEvent(
    auditEventId: AuditEventId,
    tenant: TenantContext,
  ): readonly Finding[];
  transition(
    id: FindingId,
    request: TransitionRequest,
    tenant: TenantContext,
  ): Finding;
  recordCarryForward(
    sourceId: FindingId,
    target: {
      readonly newAuditEventId: AuditEventId;
      readonly carriedAt: string;
      readonly by: AuditorId;
    },
    tenant: TenantContext,
  ): Finding;
}

export interface FindingRegistryOptions {
  readonly numbering: NumberingService;
  readonly machine: StateMachine;
  readonly ledger: LedgerEmitter;
  readonly linker: MultiClauseLinker;
  /**
   * Override for tests so we can inject deterministic IDs / timestamps.
   */
  readonly clock?: () => string;
  readonly idFactory?: () => FindingId;
}

interface Mutable {
  store: Map<string, Finding>;
}

export function createFindingRegistry(
  options: FindingRegistryOptions,
): FindingRegistry {
  const state: Mutable = { store: new Map() };
  const clock = options.clock ?? (() => new Date().toISOString());
  const idFactory = options.idFactory ?? (() => randomFindingId());

  return {
    create(input, tenant, opts) {
      assertSameTenant(input.firmId, input.clientId, tenant);
      options.linker.validate(input.clauseLinks, input.controlLinks);

      const raisedAt = clock();
      const scheme = options.numbering.schemeForType(input.type);
      const number = options.numbering.next({
        schemeKey: scheme.key,
        type: input.type,
        raisedAt,
        ...(opts?.engagementCode !== undefined
          ? { engagementCode: opts.engagementCode }
          : {}),
        ...(opts?.clientCode !== undefined
          ? { clientCode: opts.clientCode }
          : {}),
      });

      const id = idFactory();
      const initialEntry: DispositionHistoryEntry = {
        at: raisedAt,
        by: input.raisedBy,
        fromStatus: 'draft',
        toStatus: 'draft',
        action: 'created',
      };
      const finding: Finding = {
        id,
        firmId: input.firmId,
        clientId: input.clientId,
        engagementId: input.engagementId,
        auditEventId: input.auditEventId,
        type: input.type,
        number,
        clauseLinks: input.clauseLinks,
        controlLinks: input.controlLinks,
        evidenceLinks: input.evidenceLinks,
        requirementText: input.requirementText,
        statementText: input.statementText,
        rootCausePromptResponse: input.rootCausePromptResponse,
        raisedBy: input.raisedBy,
        raisedAt,
        status: 'draft',
        severity: input.severity,
        riskRating: input.riskRating,
        dispositionHistory: [initialEntry],
        topicTags: input.topicTags ?? [],
        ...(input.carryForwardFrom !== undefined
          ? { carryForwardFrom: input.carryForwardFrom }
          : {}),
        updatedAt: raisedAt,
      };
      state.store.set(id, finding);

      const payload: FindingCreatedPayload = {
        type: finding.type,
        number: finding.number,
        clauseLinkCount: finding.clauseLinks.length,
        controlLinkCount: finding.controlLinks.length,
        evidenceLinkCount: finding.evidenceLinks.length,
      };
      options.ledger.emit({
        kind: 'finding.created',
        findingId: finding.id,
        firmId: finding.firmId,
        clientId: finding.clientId,
        engagementId: finding.engagementId,
        auditEventId: finding.auditEventId,
        at: raisedAt,
        by: finding.raisedBy,
        payload: payload as unknown as Readonly<Record<string, unknown>>,
      });

      return finding;
    },

    get(id, tenant) {
      const f = this.tryGet(id, tenant);
      if (!f) throw new NotFoundError('Finding', id);
      return f;
    },

    tryGet(id, tenant) {
      const f = state.store.get(id);
      if (!f) return undefined;
      assertSameTenant(f.firmId, f.clientId, tenant);
      return f;
    },

    listByEngagement(engagementId, tenant) {
      const out: Finding[] = [];
      for (const f of state.store.values()) {
        if (
          f.engagementId === engagementId &&
          f.firmId === tenant.firmId &&
          f.clientId === tenant.clientId
        ) {
          out.push(f);
        }
      }
      return out;
    },

    listByAuditEvent(auditEventId, tenant) {
      const out: Finding[] = [];
      for (const f of state.store.values()) {
        if (
          f.auditEventId === auditEventId &&
          f.firmId === tenant.firmId &&
          f.clientId === tenant.clientId
        ) {
          out.push(f);
        }
      }
      return out;
    },

    transition(id, request, tenant) {
      const current = this.get(id, tenant);
      if (current.status === 'closed' && request.action !== 'reopen') {
        throw new ImmutableViolation(
          `Finding ${current.number} is closed; only 'reopen' is allowed`,
          { id, number: current.number, status: current.status },
        );
      }
      const at = clock();
      const result = options.machine.apply({
        action: request.action,
        from: current.status,
        role: request.role,
        by: request.by,
        at,
        ...(request.note !== undefined ? { note: request.note } : {}),
      });

      if (result.to === current.status) {
        // The state machine's `apply` returns `to` distinct from `from` for
        // every legal transition. If we ever observe a no-op here, that's
        // a logic bug â€” surface as ConflictError so it isn't silently
        // ignored.
        throw new ConflictError(
          `State machine produced no-op transition for action=${request.action}`,
          { id, action: request.action, status: current.status },
        );
      }

      const updated: Finding = {
        ...current,
        status: result.to,
        dispositionHistory: [...current.dispositionHistory, result.entry],
        updatedAt: at,
      };
      state.store.set(id, updated);

      const payload: FindingTransitionedPayload = {
        entry: result.entry,
        fromStatus: current.status,
        toStatus: result.to,
      };
      options.ledger.emit({
        kind: 'finding.transitioned',
        findingId: updated.id,
        firmId: updated.firmId,
        clientId: updated.clientId,
        engagementId: updated.engagementId,
        auditEventId: updated.auditEventId,
        at,
        by: request.by,
        payload: payload as unknown as Readonly<Record<string, unknown>>,
      });

      return updated;
    },

    recordCarryForward(sourceId, target, tenant) {
      const source = this.get(sourceId, tenant);
      const link: SurveillanceCarryForwardLink = {
        sourceFindingId: source.id,
        sourceAuditEventId: source.auditEventId,
        carriedAt: target.carriedAt,
      };
      const updated: Finding = {
        ...source,
        carryForwardFrom: link,
        updatedAt: target.carriedAt,
      };
      state.store.set(source.id, updated);

      const payload: FindingCarriedForwardPayload = {
        fromAuditEventId: source.auditEventId,
        toAuditEventId: target.newAuditEventId,
      };
      options.ledger.emit({
        kind: 'finding.carried_forward',
        findingId: source.id,
        firmId: source.firmId,
        clientId: source.clientId,
        engagementId: source.engagementId,
        auditEventId: target.newAuditEventId,
        at: target.carriedAt,
        by: target.by,
        payload: payload as unknown as Readonly<Record<string, unknown>>,
      });

      return updated;
    },
  };
}

function assertSameTenant(
  firmId: FirmId,
  clientId: ClientId,
  tenant: TenantContext,
): void {
  if (firmId !== tenant.firmId || clientId !== tenant.clientId) {
    throw new TenantViolation('Tenant mismatch on finding access', {
      expected: { firmId: tenant.firmId, clientId: tenant.clientId },
      actual: { firmId, clientId },
    });
  }
}

/**
 * Generate a v4-shaped UUID. Uses Node's crypto if available; otherwise a
 * deterministic-fallback path keyed by Date.now() + Math.random() (good
 * enough for in-memory dev use; production swaps in a `idFactory`).
 */
function randomFindingId(): FindingId {
  const cryptoRef: { randomUUID?: () => string } | undefined = (
    globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  const id = cryptoRef?.randomUUID
    ? cryptoRef.randomUUID()
    : fallbackUuidV4();
  return brandedFromUuid<'FindingId'>(id);
}

function fallbackUuidV4(): string {
  // Compose 16 random bytes, set version 4 / variant bits per RFC 4122.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  // bytes[6] and bytes[8] are guaranteed defined; assert via the
  // non-null `as number` to satisfy `noUncheckedIndexedAccess`.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-` +
    `${hex.substring(16, 20)}-${hex.substring(20, 32)}`
  );
}
