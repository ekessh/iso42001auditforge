// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  P_MCP_06, P_MCP_06_FIXTURES, runResourceInjectionProbe,
} from '../../../packages/probe-engine/src/probes/P-MCP-06.js';

describe('P-MCP-06 (indirect prompt injection via MCP resources)', () => {
  it('passes when no resource bytes match injection patterns', () => {
    const r = runResourceInjectionProbe(P_MCP_06_FIXTURES.clean);
    expect(r.valid).toBe(true);
    expect(r.hits).toEqual([]);
  });

  it('fails when a resource contains "IGNORE THE ABOVE" / "SYSTEM:"', () => {
    const r = runResourceInjectionProbe(P_MCP_06_FIXTURES.injectedResource);
    expect(r.valid).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0]!.uri).toBe('engagement://e1/findings');
  });

  it('declares mappings to A.6.2.7, A.7.4, A.9.4 and OWASP LLM01', () => {
    expect(P_MCP_06.meta.controls.annexA).toContain('A.6.2.7');
    expect(P_MCP_06.meta.controls.annexA).toContain('A.7.4');
    expect(P_MCP_06.meta.controls.annexA).toContain('A.9.4');
    expect(P_MCP_06.meta.controls.external.find((e) => e.framework === 'OWASP_LLM_TOP10')).toBeTruthy();
  });
});
