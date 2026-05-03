// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-06 — Indirect prompt injection via MCP resources.
 *
 * Auditee MCP servers expose resources (URIs returning bytes). An attacker
 * can poison a resource's content with prompt-injection markers. Any model
 * that reads the resource into its context is potentially exploited.
 *
 * This probe scans resourceBytes for injection-pattern hits.
 *
 * Maps to: A.6.2.7 (security), A.7.4 (data quality), A.9.4 (intended use).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import {
  McpServerSnapshotSchema,
  RESOURCE_INJECTION_PATTERNS,
  detectMatches,
  type McpServerSnapshot,
} from './P-MCP-shared.js';
import { P_MCP_06_FIXTURES } from './P-MCP-06.fixtures.js';

export interface ResourceInjectionHit {
  readonly uri: string;
  readonly patterns: readonly string[];
}

export interface ResourceInjectionResult {
  readonly resourcesScanned: number;
  readonly hits: readonly ResourceInjectionHit[];
  readonly valid: boolean;
}

export function runResourceInjectionProbe(
  snapshot: McpServerSnapshot,
): ResourceInjectionResult {
  const hits: ResourceInjectionHit[] = [];
  const uris = Object.keys(snapshot.resourceBytes);
  for (const uri of uris) {
    const text = snapshot.resourceBytes[uri] ?? '';
    const matched = detectMatches(text, RESOURCE_INJECTION_PATTERNS);
    if (matched.length > 0) hits.push({ uri, patterns: matched });
  }
  return {
    resourcesScanned: uris.length,
    hits: Object.freeze(hits),
    valid: hits.length === 0,
  };
}

const Params = z.object({ snapshot: McpServerSnapshotSchema.optional() });

export const P_MCP_06 = defineProbe<z.infer<typeof Params>, ResourceInjectionResult>({
  meta: {
    id: 'P-MCP-06',
    name: 'MCP indirect prompt injection via resources',
    description: 'Scans MCP resource bytes for prompt-injection patterns that would weaponize resource reads against client models.',
    version: '0.1.0',
    category: 'injection',
    targetKinds: ['agentic', 'llm-rag'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.7.4', 'A.9.4'], external: [{ framework: 'OWASP_LLM_TOP10', id: 'LLM01' }] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 30_000, memoryMaxMb: 256, cpuMaxMs: 5_000 },
    references: [{ title: 'OWASP LLM01 — indirect prompt injection' }],
    groundTruthFixturePath: 'src/probes/P-MCP-06.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'injection', 'resources'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_06_FIXTURES.clean) as McpServerSnapshot;
    const r = runResourceInjectionProbe(snapshot);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: { resourcesScanned: r.resourcesScanned, hitCount: r.hits.length },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_06_FIXTURES };
