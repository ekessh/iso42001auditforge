// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { AuditLedgerCorruption } from '@auditforge/shared';
import { GENESIS_HASH, canonicalJsonStringify, computeChainHash, sha256Hex } from './hash.js';
import { EventSchemaRegistry } from './registry.js';
import { StubTsaProvider, type TsaProvider, type TsaToken } from './tsa.js';

export interface LedgerEvent {
  readonly id: string;
  readonly firmId: string;
  readonly auditorId: string | null;
  readonly engagementId: string | null;
  readonly sequenceNumber: number;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly producer: string;
  readonly occurredAt: string;
  readonly prevHash: string;
  readonly chainHash: string;
  readonly tsaToken: TsaToken | null;
}

export interface EmitContext {
  readonly firmId: string;
  readonly auditorId?: string;
  readonly engagementId?: string;
  readonly producer: string;
  readonly occurredAt?: string;
}

export interface EmitOptions {
  readonly schemaVersion?: number;
  readonly applyTsa?: boolean;
}

export interface EventQuery {
  readonly firmId: string;
  readonly engagementId?: string;
  readonly eventTypes?: readonly string[];
  readonly fromSequence?: number;
  readonly toSequence?: number;
}

export interface EventRepository {
  getLatestForFirm(firmId: string): Promise<LedgerEvent | null>;
  insert(event: LedgerEvent): Promise<void>;
  list(query: EventQuery): Promise<LedgerEvent[]>;
}

export class InMemoryEventRepository implements EventRepository {
  private readonly events: LedgerEvent[] = [];

  async getLatestForFirm(firmId: string): Promise<LedgerEvent | null> {
    const filtered = this.events.filter((e) => e.firmId === firmId);
    if (filtered.length === 0) return null;
    return filtered.reduce((a, b) => (a.sequenceNumber >= b.sequenceNumber ? a : b));
  }

  async insert(event: LedgerEvent): Promise<void> {
    const last = await this.getLatestForFirm(event.firmId);
    if (last && last.sequenceNumber + 1 !== event.sequenceNumber) {
      throw new AuditLedgerCorruption('non-monotonic sequence number on insert', {
        expected: last.sequenceNumber + 1,
        got: event.sequenceNumber,
      });
    }
    this.events.push(event);
  }

  async list(query: EventQuery): Promise<LedgerEvent[]> {
    return this.events
      .filter((e) => {
        if (e.firmId !== query.firmId) return false;
        if (query.engagementId && e.engagementId !== query.engagementId) return false;
        if (query.eventTypes && !query.eventTypes.includes(e.eventType)) return false;
        if (query.fromSequence !== undefined && e.sequenceNumber < query.fromSequence) return false;
        if (query.toSequence !== undefined && e.sequenceNumber > query.toSequence) return false;
        return true;
      })
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  unsafeMutateForTamperTest(index: number, mutator: (e: LedgerEvent) => LedgerEvent): void {
    if (index < 0 || index >= this.events.length) throw new RangeError('index oob');
    this.events[index] = mutator(this.events[index]!);
  }
}

export interface VerifyResult {
  readonly valid: boolean;
  readonly checkedCount: number;
  readonly firstInvalidSequence?: number;
  readonly reason?: string;
}

export class AuditLedger {
  private readonly tsa: TsaProvider;

  constructor(
    private readonly repo: EventRepository,
    private readonly registry: EventSchemaRegistry,
    tsa?: TsaProvider,
  ) {
    this.tsa = tsa ?? new StubTsaProvider();
  }

  async emit(
    ctx: EmitContext,
    eventType: string,
    payload: Record<string, unknown>,
    options: EmitOptions = {},
  ): Promise<LedgerEvent> {
    const schemaVersion = options.schemaVersion ?? 1;
    const validated = this.registry.validate(eventType, schemaVersion, payload) as Record<
      string,
      unknown
    >;
    const last = await this.repo.getLatestForFirm(ctx.firmId);
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const prevHash = last?.chainHash ?? GENESIS_HASH;
    const occurredAt = ctx.occurredAt ?? new Date().toISOString();
    const id = randomUUID();
    const canonicalPayload = canonicalJsonStringify(validated);
    const metadata = canonicalJsonStringify({
      id,
      firmId: ctx.firmId,
      auditorId: ctx.auditorId ?? null,
      engagementId: ctx.engagementId ?? null,
      sequenceNumber,
      eventType,
      schemaVersion,
      producer: ctx.producer,
      occurredAt,
    });
    const chainHash = computeChainHash(prevHash, canonicalPayload, metadata);

    let tsaToken: TsaToken | null = null;
    if (options.applyTsa) {
      const digest = sha256Hex(canonicalPayload, '|', metadata);
      tsaToken = await this.tsa.sign(digest);
    }

    const event: LedgerEvent = {
      id,
      firmId: ctx.firmId,
      auditorId: ctx.auditorId ?? null,
      engagementId: ctx.engagementId ?? null,
      sequenceNumber,
      eventType,
      schemaVersion,
      payload: Object.freeze({ ...validated }),
      producer: ctx.producer,
      occurredAt,
      prevHash,
      chainHash,
      tsaToken,
    };

    await this.repo.insert(event);
    return event;
  }

  async signWithTSA(event: LedgerEvent): Promise<TsaToken> {
    const canonicalPayload = canonicalJsonStringify(event.payload);
    const metadata = canonicalJsonStringify({
      id: event.id,
      firmId: event.firmId,
      auditorId: event.auditorId,
      engagementId: event.engagementId,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      producer: event.producer,
      occurredAt: event.occurredAt,
    });
    const digest = sha256Hex(canonicalPayload, '|', metadata);
    return this.tsa.sign(digest);
  }

  async verifyChain(query: EventQuery): Promise<VerifyResult> {
    const events = await this.repo.list({ ...query });
    let prevHash = GENESIS_HASH;
    let prevSeq = 0;
    for (const e of events) {
      if (e.prevHash !== prevHash) {
        return {
          valid: false,
          checkedCount: events.length,
          firstInvalidSequence: e.sequenceNumber,
          reason: `prevHash mismatch at sequence ${e.sequenceNumber}`,
        };
      }
      if (e.sequenceNumber !== prevSeq + 1) {
        return {
          valid: false,
          checkedCount: events.length,
          firstInvalidSequence: e.sequenceNumber,
          reason: `non-monotonic sequence at ${e.sequenceNumber}, expected ${prevSeq + 1}`,
        };
      }
      const canonicalPayload = canonicalJsonStringify(e.payload);
      const metadata = canonicalJsonStringify({
        id: e.id,
        firmId: e.firmId,
        auditorId: e.auditorId,
        engagementId: e.engagementId,
        sequenceNumber: e.sequenceNumber,
        eventType: e.eventType,
        schemaVersion: e.schemaVersion,
        producer: e.producer,
        occurredAt: e.occurredAt,
      });
      const expectedHash = computeChainHash(prevHash, canonicalPayload, metadata);
      if (expectedHash !== e.chainHash) {
        return {
          valid: false,
          checkedCount: events.length,
          firstInvalidSequence: e.sequenceNumber,
          reason: `chainHash mismatch at sequence ${e.sequenceNumber}`,
        };
      }
      prevHash = e.chainHash;
      prevSeq = e.sequenceNumber;
    }
    return { valid: true, checkedCount: events.length };
  }

  async replay<TState>(
    query: EventQuery,
    reducer: (state: TState, event: LedgerEvent) => TState,
    initial: TState,
  ): Promise<TState> {
    const events = await this.repo.list({ ...query });
    return events.reduce(reducer, initial);
  }

  async listEvents(query: EventQuery): Promise<LedgerEvent[]> {
    return this.repo.list({ ...query });
  }
}
