// SPDX-License-Identifier: BUSL-1.1
//
// Audit-engine adapter — delegates to `@auditforge/audit-engine`'s
// `AuditLedger` for hash-chained, schema-validated event emission and
// chain verification.
//
// In-memory event repository is used until the Drizzle/Postgres-backed sink
// lands (see TODO(rls-migration)). The package's `AuditLedger` itself is
// production-ready; only the persistence layer is provisional.
//
// Public surface kept stable so `AuditTrailInterceptor` and other callers
// continue to compile without changes.

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  EventSchemaRegistry} from '@auditforge/audit-engine';
import {
  AuditLedger,
  InMemoryEventRepository,
  createDefaultRegistry,
  type EventQuery,
  type EventRepository,
  type LedgerEvent as PkgLedgerEvent,
} from '@auditforge/audit-engine';

export interface LedgerEventInput {
  firmId: string;
  engagementId?: string;
  actorId: string | 'system';
  actorRole?: string;
  type: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

export interface LedgerEvent {
  id: string;
  firmId: string;
  engagementId?: string;
  actorId: string;
  actorRole?: string;
  type: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  sequence: number;
  prevHash: string;
  hash: string;
  emittedAt: string;
}

/**
 * Genesis-domain bridge schema — the package's default registry validates
 * concrete domain payloads (firm.created, finding.opened, etc.). The API's
 * audit-trail interceptor however emits opaque generic envelopes for any
 * mutating endpoint. We register a permissive `audit.trail.v1` event so the
 * adapter does not reject those generic records.
 */
const AUDIT_TRAIL_EVENT_TYPE = 'audit.trail.v1';

function buildRegistry(): EventSchemaRegistry {
  const registry = createDefaultRegistry();
  // Generic audit-trail catch-all. Avoids tightly-coupling the interceptor
  // to a specific schema while still routing through the chain hash.
  registry.register({
    type: AUDIT_TRAIL_EVENT_TYPE,
    version: 1,
    schema: z.object({}).passthrough(),
  });
  return registry;
}

@Injectable()
export class AuditEngineAdapter {
  private readonly logger = new Logger(AuditEngineAdapter.name);
  private readonly repo: EventRepository;
  private readonly ledger: AuditLedger;

  constructor() {
    // TODO(rls-migration): replace InMemoryEventRepository with the
    // Postgres-backed sink (Fixer 5) once `packages/db` exposes the
    // `audit_ledger_events` Drizzle schema. The `AuditLedger` consumer
    // contract is already package-stable.
    this.repo = new InMemoryEventRepository();
    this.ledger = new AuditLedger(this.repo, buildRegistry());
  }

  /**
   * Append an event. Delegates to the package's `AuditLedger.emit`, which
   * computes the canonical hash chain and validates the payload against the
   * schema registry.
   */
  async append(input: LedgerEventInput): Promise<LedgerEvent> {
    const occurredAt = new Date().toISOString();
    const payload = {
      ...input.payload,
      // Carry generic envelope fields inside the payload so they survive
      // through the chain without colliding with the canonical schema.
      __actorId: input.actorId,
      __actorRole: input.actorRole ?? null,
      __entity: input.entity,
      __entityId: input.entityId,
      __requestId: input.requestId ?? null,
      __apiEventType: input.type,
    };
    const evt = await this.ledger.emit(
      {
        firmId: input.firmId,
        ...(input.actorId !== 'system' ? { auditorId: input.actorId } : {}),
        ...(input.engagementId !== undefined ? { engagementId: input.engagementId } : {}),
        producer: 'apps/api',
        occurredAt,
      },
      AUDIT_TRAIL_EVENT_TYPE,
      payload,
    );
    this.logger.debug(
      `ledger.append firm=${input.firmId} type=${input.type} seq=${evt.sequenceNumber}`,
    );
    return this.toApi(evt, input);
  }

  /**
   * Verify the firm's chain by replaying every event through the package's
   * verifier. Returns the chain head hash on success, or the first invalid
   * sequence number on failure.
   */
  async verifyChain(firmId: string): Promise<{ ok: boolean; head?: string; reason?: string; firstInvalidSequence?: number }> {
    const r = await this.ledger.verifyChain({ firmId });
    if (!r.valid) {
      return {
        ok: false,
        ...(r.firstInvalidSequence !== undefined ? { firstInvalidSequence: r.firstInvalidSequence } : {}),
        ...(r.reason !== undefined ? { reason: r.reason } : {}),
      };
    }
    const events = await this.ledger.listEvents({ firmId });
    const last = events[events.length - 1];
    return last ? { ok: true, head: last.chainHash } : { ok: true };
  }

  /**
   * List events for a firm. Pagination is offset-style for now — Fixer 5's
   * Postgres sink will switch this to keyset pagination over the
   * `(firm_id, sequence_number)` index.
   */
  async list(query: EventQuery): Promise<readonly LedgerEvent[]> {
    const events = await this.ledger.listEvents(query);
    return events.map((e) => this.fromPkg(e));
  }

  private toApi(evt: PkgLedgerEvent, input: LedgerEventInput): LedgerEvent {
    return {
      id: evt.id,
      firmId: evt.firmId,
      ...(evt.engagementId ? { engagementId: evt.engagementId } : {}),
      actorId: input.actorId,
      ...(input.actorRole ? { actorRole: input.actorRole } : {}),
      type: input.type,
      entity: input.entity,
      entityId: input.entityId,
      payload: input.payload,
      sequence: evt.sequenceNumber,
      prevHash: evt.prevHash,
      hash: evt.chainHash,
      emittedAt: evt.occurredAt,
    };
  }

  private fromPkg(evt: PkgLedgerEvent): LedgerEvent {
    const payload = evt.payload as Record<string, unknown>;
    const actorId =
      typeof payload['__actorId'] === 'string' ? (payload['__actorId'] as string) : (evt.auditorId ?? 'system');
    const actorRole =
      typeof payload['__actorRole'] === 'string' ? (payload['__actorRole'] as string) : undefined;
    const entity = typeof payload['__entity'] === 'string' ? (payload['__entity'] as string) : evt.eventType;
    const entityId = typeof payload['__entityId'] === 'string' ? (payload['__entityId'] as string) : evt.id;
    const apiType = typeof payload['__apiEventType'] === 'string' ? (payload['__apiEventType'] as string) : evt.eventType;
    const visiblePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!k.startsWith('__')) visiblePayload[k] = v;
    }
    return {
      id: evt.id,
      firmId: evt.firmId,
      ...(evt.engagementId ? { engagementId: evt.engagementId } : {}),
      actorId,
      ...(actorRole ? { actorRole } : {}),
      type: apiType,
      entity,
      entityId,
      payload: visiblePayload,
      sequence: evt.sequenceNumber,
      prevHash: evt.prevHash,
      hash: evt.chainHash,
      emittedAt: evt.occurredAt,
    };
  }
}
