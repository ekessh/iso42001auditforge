// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { MappingRegistry } from '../src/registry.js';
import type { FrameworkMapping } from '../src/domain.js';

const m1: FrameworkMapping = {
  id: 'm1',
  source: { framework: 'ISO42001', nodeId: '6.1.4', title: 'AI risk treatment' },
  target: { framework: 'NIST_AI_RMF', nodeId: 'MAP 1.1', title: 'context' },
  relationship: 'supports', confidence: 0.85, rationale: 'mapping rationale',
  smeSignedOffBy: null, smeSignedOffAt: null,
};
const m2: FrameworkMapping = {
  id: 'm2',
  source: { framework: 'NIST_AI_RMF', nodeId: 'MAP 1.1', title: 'context' },
  target: { framework: 'EU_AI_Act', nodeId: 'Art.9', title: 'risk mgmt' },
  relationship: 'partial', confidence: 0.7, rationale: 'mapping rationale',
  smeSignedOffBy: null, smeSignedOffAt: null,
};

describe('MappingRegistry', () => {
  it('outgoing', () => {
    const r = new MappingRegistry([m1, m2]);
    expect(r.outgoing(m1.source)).toHaveLength(1);
  });
  it('traverses 2 hops', () => {
    const r = new MappingRegistry([m1, m2]);
    const result = r.traverse(m1.source, 'EU_AI_Act');
    expect(result).toHaveLength(1);
    expect(result[0]!.nodeId).toBe('Art.9');
  });
  it('respects max depth', () => {
    const r = new MappingRegistry([m1, m2]);
    expect(r.traverse(m1.source, 'EU_AI_Act', 1)).toHaveLength(0);
  });
});
