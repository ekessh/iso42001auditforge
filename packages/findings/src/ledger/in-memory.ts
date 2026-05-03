// SPDX-License-Identifier: BUSL-1.1
/**
 * In-memory `LedgerEmitter` implementation. Used by tests and as a
 * placeholder until `@auditforge/audit-engine` provides a Postgres-backed
 * emitter. The events are append-only and the chain is strictly ordered
 * by emission sequence (we track an `index` per envelope for assertions).
 */
import type {
  FindingLedgerEnvelope,
  LedgerEmitter,
} from '../types/ledger.js';

export interface RecordedFindingLedgerEvent {
  readonly index: number;
  readonly envelope: FindingLedgerEnvelope;
}

export interface InMemoryLedger extends LedgerEmitter {
  readonly events: readonly RecordedFindingLedgerEvent[];
  byKind(kind: FindingLedgerEnvelope['kind']): readonly RecordedFindingLedgerEvent[];
  byFindingId(findingId: string): readonly RecordedFindingLedgerEvent[];
  size(): number;
  clear(): void;
}

export function inMemoryLedger(): InMemoryLedger {
  const events: RecordedFindingLedgerEvent[] = [];
  let counter = 0;

  return {
    get events() {
      return events;
    },
    emit(envelope) {
      events.push({ index: counter, envelope });
      counter += 1;
    },
    byKind(kind) {
      return events.filter((e) => e.envelope.kind === kind);
    },
    byFindingId(findingId) {
      return events.filter((e) => e.envelope.findingId === (findingId as never));
    },
    size() {
      return events.length;
    },
    clear() {
      events.length = 0;
      counter = 0;
    },
  };
}
