// SPDX-License-Identifier: BUSL-1.1

import { randomUUID } from 'node:crypto';
import type { EmitContext, EmitOptions, AuditLedger } from './ledger.js';

export type OutboxStatus = 'pending' | 'consumed' | 'failed';

export interface OutboxRecord {
  readonly id: string;
  readonly firmId: string;
  readonly engagementId: string | null;
  readonly auditorId: string | null;
  readonly producer: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly applyTsa: boolean;
  readonly enqueuedAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  consumedAt?: string;
  ledgerEventId?: string;
}

export interface OutboxRepository {
  enqueue(rec: OutboxRecord): Promise<void>;
  pickPending(limit: number): Promise<OutboxRecord[]>;
  markConsumed(id: string, ledgerEventId: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  list(): Promise<readonly OutboxRecord[]>;
}

export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly recs: OutboxRecord[] = [];
  async enqueue(rec: OutboxRecord): Promise<void> { this.recs.push({ ...rec }); }
  async pickPending(limit: number): Promise<OutboxRecord[]> {
    return this.recs.filter((r) => r.status === 'pending').slice(0, limit);
  }
  async markConsumed(id: string, ledgerEventId: string): Promise<void> {
    const r = this.recs.find((x) => x.id === id);
    if (r) { r.status = 'consumed'; r.consumedAt = new Date().toISOString(); r.ledgerEventId = ledgerEventId; }
  }
  async markFailed(id: string, error: string): Promise<void> {
    const r = this.recs.find((x) => x.id === id);
    if (r) { r.status = 'failed'; r.attempts += 1; r.lastError = error; }
  }
  async list(): Promise<readonly OutboxRecord[]> { return [...this.recs]; }
}

export interface EnqueueInput {
  readonly ctx: EmitContext;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly options?: EmitOptions;
}

export class Outbox {
  constructor(private readonly repo: OutboxRepository) {}

  async enqueue(input: EnqueueInput): Promise<OutboxRecord> {
    const rec: OutboxRecord = {
      id: randomUUID(),
      firmId: input.ctx.firmId,
      engagementId: input.ctx.engagementId ?? null,
      auditorId: input.ctx.auditorId ?? null,
      producer: input.ctx.producer,
      eventType: input.eventType,
      schemaVersion: input.options?.schemaVersion ?? 1,
      payload: Object.freeze({ ...input.payload }),
      applyTsa: input.options?.applyTsa === true,
      enqueuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };
    await this.repo.enqueue(rec);
    return rec;
  }

  async drain(ledger: AuditLedger, batchSize = 100): Promise<{ processed: number; failed: number }> {
    const batch = await this.repo.pickPending(batchSize);
    let processed = 0;
    let failed = 0;
    for (const rec of batch) {
      try {
        const evt = await ledger.emit(
          {
            firmId: rec.firmId,
            ...(rec.auditorId !== null ? { auditorId: rec.auditorId } : {}),
            ...(rec.engagementId !== null ? { engagementId: rec.engagementId } : {}),
            producer: rec.producer,
          },
          rec.eventType,
          { ...rec.payload },
          { schemaVersion: rec.schemaVersion, applyTsa: rec.applyTsa },
        );
        await this.repo.markConsumed(rec.id, evt.id);
        processed += 1;
      } catch (err) {
        await this.repo.markFailed(rec.id, (err as Error).message);
        failed += 1;
      }
    }
    return { processed, failed };
  }
}
