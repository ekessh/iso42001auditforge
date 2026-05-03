// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  P_MCP_03, P_MCP_03_FIXTURES, runAuditCompletenessProbe,
} from '../../../packages/probe-engine/src/probes/P-MCP-03.js';

describe('P-MCP-03 (audit trail completeness)', () => {
  it('passes when every session call has a matching audit row', () => {
    const r = runAuditCompletenessProbe(P_MCP_03_FIXTURES.complete);
    expect(r.valid).toBe(true);
    expect(r.missingAuditCount).toBe(0);
    expect(r.malformedEntries).toEqual([]);
  });

  it('fails when sessions report tool calls with no matching audit row', () => {
    const r = runAuditCompletenessProbe(P_MCP_03_FIXTURES.missingEntries);
    expect(r.valid).toBe(false);
    expect(r.missingAuditCount).toBeGreaterThan(0);
  });

  it('fails on malformed audit entries (missing actor, negative latency, empty paramsHash)', () => {
    const r = runAuditCompletenessProbe(P_MCP_03_FIXTURES.malformedEntries);
    expect(r.valid).toBe(false);
    expect(r.malformedEntries.length).toBeGreaterThan(0);
  });

  it('declares mappings to A.6.2.8 and A.6.2.7', () => {
    expect(P_MCP_03.meta.controls.annexA).toContain('A.6.2.8');
    expect(P_MCP_03.meta.controls.annexA).toContain('A.6.2.7');
  });
});
