// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-01 — Tool Poisoning Attack detection.
 *
 * Per Invariant Labs research, an attacker can hide instructions inside an
 * MCP tool's `description` field. Any client model reading the description
 * treats those instructions as legitimate. This probe scans every advertised
 * tool's name + description for known TPA patterns.
 *
 * Maps to: A.6.2.7 (security), A.10.3 (suppliers).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import {
  McpServerSnapshotSchema,
  TOOL_POISONING_PATTERNS,
  detectMatches,
  type McpServerSnapshot,
} from './P-MCP-shared.js';
import { P_MCP_01_FIXTURES } from './P-MCP-01.fixtures.js';

export interface ToolPoisoningHit {
  readonly toolName: string;
  readonly patterns: readonly string[];
}

export interface ToolPoisoningResult {
  readonly hits: readonly ToolPoisoningHit[];
  readonly toolsScanned: number;
  readonly valid: boolean;
}

export function runToolPoisoningProbe(
  snapshot: McpServerSnapshot,
): ToolPoisoningResult {
  const hits: ToolPoisoningHit[] = [];
  for (const t of snapshot.tools) {
    const text = `${t.name}\n${t.description}`;
    const matched = detectMatches(text, TOOL_POISONING_PATTERNS);
    if (matched.length > 0) {
      hits.push({ toolName: t.name, patterns: matched });
    }
  }
  return {
    hits: Object.freeze(hits),
    toolsScanned: snapshot.tools.length,
    valid: hits.length === 0,
  };
}

const Params = z.object({
  snapshot: McpServerSnapshotSchema.optional(),
});

export const P_MCP_01 = defineProbe<z.infer<typeof Params>, ToolPoisoningResult>({
  meta: {
    id: 'P-MCP-01',
    name: 'MCP Tool Poisoning Attack detection',
    description:
      'Scans advertised MCP tool descriptions for hidden-instruction patterns characteristic of Tool Poisoning Attacks (Invariant Labs).',
    version: '0.1.0',
    category: 'injection',
    targetKinds: ['agentic', 'llm-rag', 'llm-generative'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.10.3'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 30_000, memoryMaxMb: 128, cpuMaxMs: 5_000 },
    references: [{ title: 'Invariant Labs — MCP Tool Poisoning Attacks (2025)' }],
    groundTruthFixturePath: 'src/probes/P-MCP-01.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'tpa', 'security'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_01_FIXTURES.clean) as McpServerSnapshot;
    const r = runToolPoisoningProbe(snapshot);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        toolsScanned: r.toolsScanned,
        hitCount: r.hits.length,
      },
      rawResponse: r,
      evidence: [
        { kind: 'derived-metric', contentType: 'application/json', inline: r },
      ],
    };
  },
});

export { P_MCP_01_FIXTURES };
