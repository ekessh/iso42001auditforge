// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors

import { createHash } from "node:crypto";

export interface LedgerEvent {
  readonly seq: number;
  readonly engagementId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly prevHash: string;
  readonly payloadHash: string;
  readonly signedAt: Date;
}

const ZERO = "0".repeat(64);

const canonicalJson = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
};

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/**
 * Test double for the audit ledger. Implements the same chain semantics as
 * `packages/audit-engine/src/chain-verifier.ts` but in-memory, so unit tests
 * can assert chain integrity without booting Postgres.
 */
export class LedgerDouble {
  private readonly events: LedgerEvent[] = [];

  append(engagementId: string, type: string, payload: unknown, signedAt = new Date()): LedgerEvent {
    const seq = this.events.length + 1;
    const prevHash = this.events.length === 0 ? ZERO : this.events[this.events.length - 1]!.payloadHash;
    const payloadHash = sha256(canonicalJson({ seq, engagementId, type, payload, prevHash }));
    const event: LedgerEvent = { seq, engagementId, type, payload, prevHash, payloadHash, signedAt };
    this.events.push(event);
    return event;
  }

  all(): ReadonlyArray<LedgerEvent> {
    return [...this.events];
  }

  filter(predicate: (e: LedgerEvent) => boolean): ReadonlyArray<LedgerEvent> {
    return this.events.filter(predicate);
  }

  length(): number {
    return this.events.length;
  }

  verifyChain(): { ok: boolean; brokenAtSeq?: number } {
    let prev = ZERO;
    for (const e of this.events) {
      if (e.prevHash !== prev) return { ok: false, brokenAtSeq: e.seq };
      const expected = sha256(canonicalJson({
        seq: e.seq, engagementId: e.engagementId, type: e.type, payload: e.payload, prevHash: e.prevHash,
      }));
      if (expected !== e.payloadHash) return { ok: false, brokenAtSeq: e.seq };
      prev = e.payloadHash;
    }
    return { ok: true };
  }

  clear(): void {
    this.events.length = 0;
  }
}
