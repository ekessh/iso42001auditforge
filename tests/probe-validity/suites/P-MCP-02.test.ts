// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { P_MCP_02, P_MCP_02_FIXTURES, runAllowlistProbe } from '../../../packages/probe-engine/src/probes/P-MCP-02.js';

describe('P-MCP-02 (server allowlist)', () => {
  it('passes when every observed server is on the allowlist and enforcement is on', () => {
    const r = runAllowlistProbe(
      P_MCP_02_FIXTURES.clean.snapshots,
      P_MCP_02_FIXTURES.clean.allowlist,
    );
    expect(r.valid).toBe(true);
    expect(r.unauthorized).toEqual([]);
    expect(r.enforcementDeclared).toBe(true);
  });

  it('fails on an unauthorized server reachable from the gateway', () => {
    const r = runAllowlistProbe(
      P_MCP_02_FIXTURES.unauthorizedServer.snapshots,
      P_MCP_02_FIXTURES.unauthorizedServer.allowlist,
    );
    expect(r.valid).toBe(false);
    expect(r.unauthorized).toContain('srv-attacker-3');
  });

  it('fails when enforcement is declared off, even with a clean list', () => {
    const r = runAllowlistProbe(
      P_MCP_02_FIXTURES.enforcementDisabled.snapshots,
      P_MCP_02_FIXTURES.enforcementDisabled.allowlist,
    );
    expect(r.valid).toBe(false);
    expect(r.enforcementDeclared).toBe(false);
  });

  it('declares mappings to A.10.3 and A.6.2.7', () => {
    expect(P_MCP_02.meta.controls.annexA).toContain('A.10.3');
    expect(P_MCP_02.meta.controls.annexA).toContain('A.6.2.7');
  });
});
