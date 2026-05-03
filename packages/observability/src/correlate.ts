// SPDX-License-Identifier: Apache-2.0
/**
 * Audit-ledger correlation helpers.
 *
 * Goal: every audit-ledger event must be joinable back to:
 *   - the originating HTTP request (`request_id`)
 *   - the OTel trace (`trace_id`/`span_id`)
 *   - the next pino log line emitted while the call stack is still active
 *
 * Design:
 *   - `attachLedgerEventIdToActiveSpan(eventId)` sets `auditforge.ledger.event_id` on the active span.
 *   - The same call stashes the event id in a per-execution-context slot. The pino logger consumes that
 *     slot exactly once (see {@link takeLedgerEventIdForLog}) so the immediate next log line carries
 *     `ledger_event_id`. The slot is then cleared so the field does not bleed across unrelated lines.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { trace } from '@opentelemetry/api';

interface CorrelationFrame {
  pendingLedgerEventId?: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationFrame>();

/**
 * Run `fn` within a fresh correlation frame. Required only at the top of an async chain that wants
 * to use the per-line ledger-event-id stash. In Nest, the `AuditTrailInterceptor` arranges this.
 */
export function runWithCorrelationFrame<T>(fn: () => T): T {
  return correlationStorage.run({}, fn);
}

/**
 * Mark the currently active OTel span with the audit-ledger event id, and stash it for the next
 * pino log line. No-ops cleanly when there is no active span / no correlation frame.
 */
export function attachLedgerEventIdToActiveSpan(eventId: string): void {
  const span = trace.getActiveSpan();
  if (span !== undefined) {
    span.setAttribute('auditforge.ledger.event_id', eventId);
  }
  const frame = correlationStorage.getStore();
  if (frame !== undefined) {
    frame.pendingLedgerEventId = eventId;
  }
}

/**
 * Consumed by the pino mixin. Returns the stashed ledger event id (if any) and clears the slot
 * so subsequent log lines do not inherit it.
 */
export function takeLedgerEventIdForLog(): string | undefined {
  const frame = correlationStorage.getStore();
  if (frame === undefined) return undefined;
  const id = frame.pendingLedgerEventId;
  frame.pendingLedgerEventId = undefined;
  return id;
}

/** Read the OTel trace id from the active span without touching correlation state. */
export function readActiveTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span === undefined) return undefined;
  const ctx = span.spanContext();
  if (ctx.traceId === '00000000000000000000000000000000') return undefined;
  return ctx.traceId;
}

/** Test/utility-only helper to seed a frame for the duration of a synchronous block. */
export function _setPendingLedgerEventIdForTest(eventId: string | undefined): void {
  const frame = correlationStorage.getStore();
  if (frame === undefined) return;
  frame.pendingLedgerEventId = eventId;
}
