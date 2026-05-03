// SPDX-License-Identifier: BUSL-1.1
/**
 * Audit ledger sinks. Each MCP request emits one ledger event; tools that hit
 * the conversational engine additionally emit one `llm_invocations` row.
 *
 * The default sink is in-memory and used by tests + dev. Production wires the
 * `PostgresAuditLedgerSink` (lives in `apps/api`) which double-writes to the
 * append-only `audit_ledger` table and the `llm_invocations` table.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  AuditLedgerSink,
  LlmInvocationEntry,
  McpLedgerEvent,
  McpLogger,
} from './types.js';

/**
 * Hash a tool's parameters for the ledger. Stable JSON canonicalization
 * (sorted keys, no whitespace) so the same params always hash identically.
 */
export function hashParams(params: unknown): string {
  return createHash('sha256').update(canonicalJson(params)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const visit = (v: unknown): unknown => {
    if (v === null) return null;
    if (typeof v !== 'object') {
      if (typeof v === 'bigint') return v.toString();
      return v;
    }
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(visit);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = visit(obj[k]);
    }
    return out;
  };
  return JSON.stringify(visit(value));
}

/**
 * In-memory ledger sink. Used by tests and dev. Captures every event so a
 * test can assert "this tool emitted exactly these ledger entries."
 */
export class InMemoryLedger implements AuditLedgerSink {
  readonly events: McpLedgerEvent[] = [];
  readonly llmEntries: LlmInvocationEntry[] = [];

  async emit(event: McpLedgerEvent): Promise<void> {
    Object.freeze(event);
    this.events.push(event);
  }

  async emitLlm(entry: LlmInvocationEntry): Promise<void> {
    Object.freeze(entry);
    this.llmEntries.push(entry);
  }

  reset(): void {
    this.events.length = 0;
    this.llmEntries.length = 0;
  }
}

/**
 * Convenience wrapper that emits with sane defaults populated. Tools call
 * this; the underlying sink decides how to persist.
 */
export class LedgerEmitter {
  private readonly sink: AuditLedgerSink;
  private readonly log: McpLogger;
  private readonly now: () => Date;

  constructor(sink: AuditLedgerSink, log: McpLogger, now: () => Date = () => new Date()) {
    this.sink = sink;
    this.log = log;
    this.now = now;
  }

  async emitToolEvent(input: {
    readonly tool: string;
    readonly principalSub: string | null;
    readonly auditorId: string | null;
    readonly firmId: string | null;
    readonly tokenId: string | null;
    readonly engagementId: string | null;
    readonly paramsHash: string;
    readonly verdict: 'allowed' | 'denied' | 'error';
    readonly errorCode: string | null;
    readonly latencyMs: number;
  }): Promise<void> {
    const event: McpLedgerEvent = {
      type: 'mcp.tool.invoked',
      occurredAt: this.now().toISOString(),
      actorId: input.auditorId,
      firmId: input.firmId,
      tokenId: input.tokenId,
      engagementId: input.engagementId,
      tool: input.tool,
      resource: null,
      paramsHash: input.paramsHash,
      verdict: input.verdict,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    };
    try {
      await this.sink.emit(event);
    } catch (err) {
      this.log.error('audit.ledger.emit_failed', {
        tool: input.tool,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async emitResourceEvent(input: {
    readonly resource: string;
    readonly auditorId: string | null;
    readonly firmId: string | null;
    readonly tokenId: string | null;
    readonly engagementId: string | null;
    readonly verdict: 'allowed' | 'denied' | 'error';
    readonly errorCode: string | null;
    readonly latencyMs: number;
  }): Promise<void> {
    const event: McpLedgerEvent = {
      type: 'mcp.resource.read',
      occurredAt: this.now().toISOString(),
      actorId: input.auditorId,
      firmId: input.firmId,
      tokenId: input.tokenId,
      engagementId: input.engagementId,
      tool: null,
      resource: input.resource,
      paramsHash: hashParams({ resource: input.resource }),
      verdict: input.verdict,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    };
    try {
      await this.sink.emit(event);
    } catch (err) {
      this.log.error('audit.ledger.emit_failed', {
        resource: input.resource,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async emitAuthDenied(input: {
    readonly tool: string | null;
    readonly resource: string | null;
    readonly errorCode: string;
    readonly latencyMs: number;
  }): Promise<void> {
    const event: McpLedgerEvent = {
      type: 'mcp.auth.denied',
      occurredAt: this.now().toISOString(),
      actorId: null,
      firmId: null,
      tokenId: null,
      engagementId: null,
      tool: input.tool,
      resource: input.resource,
      paramsHash: '',
      verdict: 'denied',
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    };
    try {
      await this.sink.emit(event);
    } catch (err) {
      this.log.error('audit.ledger.emit_failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async emitLlmInvocation(entry: Omit<LlmInvocationEntry, 'invocationId' | 'occurredAt'>): Promise<string> {
    const full: LlmInvocationEntry = {
      ...entry,
      invocationId: randomUUID(),
      occurredAt: this.now().toISOString(),
    };
    try {
      await this.sink.emitLlm(full);
    } catch (err) {
      this.log.error('audit.ledger.emit_failed', {
        purpose: entry.purpose,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return full.invocationId;
  }
}

/** Console logger for dev / fallback. */
export const consoleLogger: McpLogger = {
  debug: (msg, fields) => console.debug(JSON.stringify({ level: 'debug', msg, ...fields })),
  info: (msg, fields) => console.info(JSON.stringify({ level: 'info', msg, ...fields })),
  warn: (msg, fields) => console.warn(JSON.stringify({ level: 'warn', msg, ...fields })),
  error: (msg, fields) => console.error(JSON.stringify({ level: 'error', msg, ...fields })),
};

/** No-op logger. */
export const nullLogger: McpLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
