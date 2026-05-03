// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { P_MCP_07, P_MCP_07_FIXTURES, runIsolationProbe } from '../../../packages/probe-engine/src/probes/P-MCP-07.js';

describe('P-MCP-07 (cross-server session isolation)', () => {
  it('passes when isolation is declared and no leakage observed', () => {
    const r = runIsolationProbe(P_MCP_07_FIXTURES.isolated);
    expect(r.valid).toBe(true);
    expect(r.serversWithoutScoping).toEqual([]);
    expect(r.leakingSessions).toEqual([]);
  });

  it('fails when a server is declared unscoped', () => {
    const r = runIsolationProbe(P_MCP_07_FIXTURES.unscoped);
    expect(r.valid).toBe(false);
    expect(r.serversWithoutScoping.length).toBeGreaterThan(0);
  });

  it('fails when a session reports context leakage', () => {
    const r = runIsolationProbe(P_MCP_07_FIXTURES.leaking);
    expect(r.valid).toBe(false);
    expect(r.leakingSessions).toContain('s-leak');
  });

  it('declares mappings to A.6.2.7 and A.10.3', () => {
    expect(P_MCP_07.meta.controls.annexA).toContain('A.6.2.7');
    expect(P_MCP_07.meta.controls.annexA).toContain('A.10.3');
  });
});
