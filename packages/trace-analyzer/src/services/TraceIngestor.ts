// SPDX-License-Identifier: BUSL-1.1
//
// TraceIngestor: idempotent ingest layer in front of the trace importers.
//
// AuditForge ingests traces from many sources (Langfuse export drops, OTel
// pipeline replays, Phoenix dumps, hand-uploaded JSON). The same trace may
// arrive twice; we de-dupe on (engagementId, traceId). Storage is pluggable
// via TraceStore so the package can be embedded without a database
// dependency in tests.

import { Readable } from 'node:stream';
import {
  importLangfuse,
  importOtelStream,
  importPhoenix,
  importCustom,
  type LangfuseImportOptions,
  type PhoenixImportOptions,
  type CustomImportOptions,
} from '../importers/trace.js';
import type { AgentTrace } from '../types/trace.js';

export interface TraceStore {
  has(engagementId: string, traceId: string): Promise<boolean> | boolean;
  put(trace: AgentTrace): Promise<void> | void;
  get(engagementId: string, traceId: string): Promise<AgentTrace | undefined> | AgentTrace | undefined;
}

/** In-memory store, suitable for tests and smaller deployments. */
export class InMemoryTraceStore implements TraceStore {
  private readonly map = new Map<string, AgentTrace>();
  private key(e: string, t: string): string {
    return `${e}::${t}`;
  }
  has(e: string, t: string): boolean {
    return this.map.has(this.key(e, t));
  }
  put(trace: AgentTrace): void {
    this.map.set(this.key(trace.engagementId, trace.id), trace);
  }
  get(e: string, t: string): AgentTrace | undefined {
    return this.map.get(this.key(e, t));
  }
  size(): number {
    return this.map.size;
  }
}

export interface IngestResult {
  trace: AgentTrace;
  /** True when this exact (engagementId, traceId) was already present. */
  deduplicated: boolean;
}

export class TraceIngestor {
  constructor(private readonly store: TraceStore = new InMemoryTraceStore()) {}

  async ingestOtel(
    source: Readable | string,
    opts: { engagementId: string; traceId: string },
  ): Promise<IngestResult> {
    const already = await this.store.has(opts.engagementId, opts.traceId);
    if (already) {
      const existing = await this.store.get(opts.engagementId, opts.traceId);
      if (existing) return { trace: existing, deduplicated: true };
    }
    const src =
      typeof source === 'string' ? Readable.from([source]) : source;
    const trace = await importOtelStream(src, opts);
    await this.store.put(trace);
    return { trace, deduplicated: false };
  }

  async ingestLangfuse(
    payload: unknown,
    opts: LangfuseImportOptions,
  ): Promise<IngestResult> {
    const already = await this.store.has(opts.engagementId, opts.traceId);
    if (already) {
      const existing = await this.store.get(opts.engagementId, opts.traceId);
      if (existing) return { trace: existing, deduplicated: true };
    }
    const trace = importLangfuse(payload, opts);
    await this.store.put(trace);
    return { trace, deduplicated: false };
  }

  async ingestPhoenix(
    payload: unknown,
    opts: PhoenixImportOptions,
  ): Promise<IngestResult> {
    const already = await this.store.has(opts.engagementId, opts.traceId);
    if (already) {
      const existing = await this.store.get(opts.engagementId, opts.traceId);
      if (existing) return { trace: existing, deduplicated: true };
    }
    const trace = importPhoenix(payload, opts);
    await this.store.put(trace);
    return { trace, deduplicated: false };
  }

  async ingestCustom(
    payload: unknown,
    opts: CustomImportOptions,
  ): Promise<IngestResult> {
    const already = await this.store.has(opts.engagementId, opts.traceId);
    if (already) {
      const existing = await this.store.get(opts.engagementId, opts.traceId);
      if (existing) return { trace: existing, deduplicated: true };
    }
    const trace = importCustom(payload, opts);
    await this.store.put(trace);
    return { trace, deduplicated: false };
  }
}
