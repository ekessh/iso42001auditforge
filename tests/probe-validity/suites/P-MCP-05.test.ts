// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { P_MCP_05, P_MCP_05_FIXTURES, runRbacProbe } from '../../../packages/probe-engine/src/probes/P-MCP-05.js';

describe('P-MCP-05 (per-tool RBAC enforcement)', () => {
  it('passes when every tool has a non-empty role list and audit rows have actors', () => {
    const r = runRbacProbe(P_MCP_05_FIXTURES.enforced);
    expect(r.valid).toBe(true);
    expect(r.toolsWithoutRoles).toEqual([]);
    expect(r.deniedRowsLogged).toBeGreaterThan(0);
  });

  it('fails when a tool has no allowed roles (wildcard / blank policy)', () => {
    const r = runRbacProbe(P_MCP_05_FIXTURES.toolWithoutRoles);
    expect(r.valid).toBe(false);
    expect(r.toolsWithoutRoles).toContain('list_engagements');
  });

  it('fails when an allowed audit row has no actor', () => {
    const r = runRbacProbe(P_MCP_05_FIXTURES.allowedWithoutActor);
    expect(r.valid).toBe(false);
    expect(r.allowedWithoutActor).toBeGreaterThan(0);
  });

  it('declares mappings to A.6.2.7 and A.9.4', () => {
    expect(P_MCP_05.meta.controls.annexA).toContain('A.6.2.7');
    expect(P_MCP_05.meta.controls.annexA).toContain('A.9.4');
  });
});
