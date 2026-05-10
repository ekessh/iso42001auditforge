// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { describe, it, expect } from "vitest";
import { LedgerDouble } from "../src/ledger-double.js";

describe("@auditforge/test-helpers / LedgerDouble", () => {
  it("appends events with monotonically increasing seq", () => {
    const l = new LedgerDouble();
    const a = l.append("eng-1", "engagement.created", { name: "X" });
    const b = l.append("eng-1", "finding.promoted", { id: "f-1" });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(l.length()).toBe(2);
  });

  it("links events via prevHash", () => {
    const l = new LedgerDouble();
    const a = l.append("eng-1", "x", {});
    const b = l.append("eng-1", "y", {});
    expect(b.prevHash).toBe(a.payloadHash);
  });

  it("verifies an untampered chain", () => {
    const l = new LedgerDouble();
    for (let i = 0; i < 50; i += 1) l.append("eng-1", "synthetic", { i });
    expect(l.verifyChain()).toEqual({ ok: true });
  });

  it("detects tampering via direct array mutation", () => {
    const l = new LedgerDouble();
    l.append("eng-1", "x", { v: 1 });
    l.append("eng-1", "y", { v: 2 });
    const events = l.all() as Array<{ payload: unknown }>;
    (events[1] as { payload: unknown }).payload = { v: 999 };
    // verifyChain reads from the live array; we mutated a snapshot, so the
    // double's chain remains intact. To prove the verifier rejects bad data
    // we construct a corrupt double:
    const corrupt = new LedgerDouble();
    const a = corrupt.append("eng-1", "x", { v: 1 });
    const b = corrupt.append("eng-1", "y", { v: 2 });
    // poke private state via a cast for the negative test
    const arr = (corrupt as unknown as { events: Array<{ payload: unknown; seq: number; prevHash: string; payloadHash: string }> }).events;
    arr[1]!.payload = { v: "tampered" };
    const result = corrupt.verifyChain();
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(2);
    void a; void b;
  });
});
