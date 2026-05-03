// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { P_MCP_04, P_MCP_04_FIXTURES, runAuthModeProbe } from '../../../packages/probe-engine/src/probes/P-MCP-04.js';

describe('P-MCP-04 (auth mode)', () => {
  it('passes for OAuth', () => {
    const r = runAuthModeProbe(P_MCP_04_FIXTURES.oauth);
    expect(r.valid).toBe(true);
    expect(r.mode).toBe('oauth');
  });

  it('passes for mTLS by exception', () => {
    const r = runAuthModeProbe(P_MCP_04_FIXTURES.mtls, { allowMtls: true });
    expect(r.valid).toBe(true);
  });

  it('fails for static-secret', () => {
    const r = runAuthModeProbe(P_MCP_04_FIXTURES.staticSecret);
    expect(r.valid).toBe(false);
    expect(r.mode).toBe('static-secret');
  });

  it('fails for none-auth', () => {
    const r = runAuthModeProbe(P_MCP_04_FIXTURES.none);
    expect(r.valid).toBe(false);
  });

  it('mTLS can be denied when allowMtls=false', () => {
    const r = runAuthModeProbe(P_MCP_04_FIXTURES.mtls, { allowMtls: false });
    expect(r.valid).toBe(false);
  });

  it('declares mappings to A.6.2.7 and A.10.3', () => {
    expect(P_MCP_04.meta.controls.annexA).toContain('A.6.2.7');
    expect(P_MCP_04.meta.controls.annexA).toContain('A.10.3');
  });
});
