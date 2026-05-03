// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  P_MCP_08, P_MCP_08_FIXTURES, runGatewayPolicyProbe,
} from '../../../packages/probe-engine/src/probes/P-MCP-08.js';

describe('P-MCP-08 (gateway policy enforcement)', () => {
  it('passes when every denied attempt was blocked AND audited', () => {
    const f = P_MCP_08_FIXTURES.passing;
    const r = runGatewayPolicyProbe(f.snapshot, f.outcomes);
    expect(r.valid).toBe(true);
    expect(r.allowedThatShouldBeDenied).toEqual([]);
    expect(r.missingAuditRows).toEqual([]);
  });

  it('fails when a denial attempt was actually allowed', () => {
    const f = P_MCP_08_FIXTURES.bypassedDenial;
    const r = runGatewayPolicyProbe(f.snapshot, f.outcomes);
    expect(r.valid).toBe(false);
    expect(r.allowedThatShouldBeDenied).toContain('a1');
  });

  it('fails when a denial happened silently (no audit row)', () => {
    const f = P_MCP_08_FIXTURES.silentDenial;
    const r = runGatewayPolicyProbe(f.snapshot, f.outcomes);
    expect(r.valid).toBe(false);
    expect(r.missingAuditRows).toContain('a1');
  });

  it('fails when the gateway declares enforcement off', () => {
    const f = P_MCP_08_FIXTURES.enforcementDisabled;
    const r = runGatewayPolicyProbe(f.snapshot, f.outcomes);
    expect(r.valid).toBe(false);
    expect(r.enforcementDeclared).toBe(false);
  });

  it('declares mappings to A.6.2.7, A.6.2.8, A.10.3', () => {
    expect(P_MCP_08.meta.controls.annexA).toEqual(
      expect.arrayContaining(['A.6.2.7', 'A.6.2.8', 'A.10.3']),
    );
  });
});
