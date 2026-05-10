// SPDX-License-Identifier: BUSL-1.1
/**
 * Per-dependency health checks. Each ping is a non-throwing async predicate plus
 * latency capture; the controller composes them and returns an overall status.
 *
 * WHY non-throwing: a single dep failure must not crash the readiness probe — kubelet expects a
 * 200/503 response, never a stack trace.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type postgres from 'postgres';

import { PG_CLIENT } from '../db/db.module.js';
import { REDIS } from '../queue/queue.module.js';

export type DepStatus = 'up' | 'down' | 'skipped';

export interface DepResult {
  readonly status: DepStatus;
  readonly latencyMs: number;
  readonly detail?: string;
}

export interface HealthSnapshot {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly deps: Record<'db' | 'redis' | 'meilisearch' | 'ollama' | 'tsa', DepResult>;
  readonly checkedAt: string;
}

export interface MeilisearchPing {
  ping(): Promise<boolean>;
}

export interface OllamaPing {
  ping(): Promise<boolean>;
}

export interface TsaPing {
  ping(): Promise<boolean>;
}

export const MEILI_PING = Symbol.for('AuditForge.Health.Meilisearch');
export const OLLAMA_PING = Symbol.for('AuditForge.Health.Ollama');
export const TSA_PING = Symbol.for('AuditForge.Health.Tsa');

@Injectable()
export class DepsHealthService {
  constructor(
    @Inject(PG_CLIENT) private readonly sql: postgres.Sql,
    @Inject(REDIS) private readonly redis: Redis,
    @Optional() @Inject(MEILI_PING) private readonly meili?: MeilisearchPing,
    @Optional() @Inject(OLLAMA_PING) private readonly ollama?: OllamaPing,
    @Optional() @Inject(TSA_PING) private readonly tsa?: TsaPing,
  ) {}

  async snapshot(): Promise<HealthSnapshot> {
    const [db, redis, meili, ollama, tsa] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkMeili(),
      this.checkOllama(),
      this.checkTsa(),
    ]);
    const downCount = [db, redis].filter((d) => d.status === 'down').length;
    const optionalDown = [meili, ollama, tsa].filter((d) => d.status === 'down').length;
    let status: HealthSnapshot['status'] = 'ok';
    if (downCount > 0) status = 'down';
    else if (optionalDown > 0) status = 'degraded';
    return {
      status,
      deps: { db, redis, meilisearch: meili, ollama, tsa },
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<DepResult> {
    const start = Date.now();
    try {
      await this.sql`select 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'down', latencyMs: Date.now() - start, detail: errMessage(e) };
    }
  }

  private async checkRedis(): Promise<DepResult> {
    const start = Date.now();
    try {
      const reply = await this.redis.ping();
      const ok = reply === 'PONG' || reply === 'pong';
      if (!ok) return { status: 'down', latencyMs: Date.now() - start, detail: `unexpected reply ${reply}` };
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'down', latencyMs: Date.now() - start, detail: errMessage(e) };
    }
  }

  private async checkMeili(): Promise<DepResult> {
    if (this.meili === undefined) return { status: 'skipped', latencyMs: 0 };
    const start = Date.now();
    try {
      const ok = await this.meili.ping();
      return ok
        ? { status: 'up', latencyMs: Date.now() - start }
        : { status: 'down', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'down', latencyMs: Date.now() - start, detail: errMessage(e) };
    }
  }

  private async checkOllama(): Promise<DepResult> {
    if (this.ollama === undefined) return { status: 'skipped', latencyMs: 0 };
    const start = Date.now();
    try {
      const ok = await this.ollama.ping();
      return ok
        ? { status: 'up', latencyMs: Date.now() - start }
        : { status: 'down', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'down', latencyMs: Date.now() - start, detail: errMessage(e) };
    }
  }

  private async checkTsa(): Promise<DepResult> {
    if (this.tsa === undefined) return { status: 'skipped', latencyMs: 0 };
    const start = Date.now();
    try {
      const ok = await this.tsa.ping();
      return ok
        ? { status: 'up', latencyMs: Date.now() - start }
        : { status: 'down', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'down', latencyMs: Date.now() - start, detail: errMessage(e) };
    }
  }
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
