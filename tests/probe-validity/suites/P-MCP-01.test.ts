// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  P_MCP_01,
  P_MCP_01_FIXTURES,
  runToolPoisoningProbe,
} from '../../../packages/probe-engine/src/probes/P-MCP-01.js';

describe('P-MCP-01 (Tool Poisoning Attack detection)', () => {
  it('passes on a clean snapshot', () => {
    const r = runToolPoisoningProbe(P_MCP_01_FIXTURES.clean);
    expect(r.valid).toBe(true);
    expect(r.toolsScanned).toBe(P_MCP_01_FIXTURES.clean.tools.length);
  });

  it('fails when a tool description hides a "ignore previous instructions" payload', () => {
    const r = runToolPoisoningProbe(P_MCP_01_FIXTURES.poisoned);
    expect(r.valid).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0]!.toolName).toBe('helpful_tool');
  });

  it('declares mappings to A.6.2.7 and A.10.3', () => {
    expect(P_MCP_01.meta.controls.annexA).toContain('A.6.2.7');
    expect(P_MCP_01.meta.controls.annexA).toContain('A.10.3');
  });
});
