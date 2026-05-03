// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-03 — MCP audit trail completeness.
 *
 * Per the 2026 MCP spec roadmap, every server-side tool invocation MUST emit
 * a structured audit record. This probe checks two properties:
 *   (a) every observed tool/resource invocation has a matching audit row, and
 *   (b) audit rows are well-formed (actor, verdict, paramsHash, latency).
 *
 * Maps to: A.6.2.8 (event logging), A.6.2.7 (security).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_03_FIXTURES } from './P-MCP-03.fixtures.js';

export interface AuditCompletenessResult {
  readonly toolInvocationsObserved: number;
  readonly resourceReadsObserved: number;
  readonly auditEntries: number;
  readonly missingAuditCount: number;
  readonly malformedEntries: readonly string[];
  readonly valid: boolean;
}

export function runAuditCompletenessProbe(
  snapshot: McpServerSnapshot,
): AuditCompletenessResult {
  const toolInvs = snapshot.auditTrail.filter((e) => e.type === 'tool.invoked').length;
  const resReads = snapshot.auditTrail.filter((e) => e.type === 'resource.read').length;
  const malformed: string[] = [];
  for (const e of snapshot.auditTrail) {
    if (!e.paramsHash) malformed.push(`${e.type}@${e.occurredAt}: missing paramsHash`);
    if (e.latencyMs < 0) malformed.push(`${e.type}@${e.occurredAt}: negative latency`);
    if (e.verdict === 'allowed' && e.actorId === null) {
      malformed.push(`${e.type}@${e.occurredAt}: allowed without actor`);
    }
  }
  // The "missing" count is reported when a session calls a tool but no
  // matching audit row exists. We compare per-session tool/resource calls
  // with audit entries.
  const audited = new Set(
    snapshot.auditTrail
      .filter((e) => e.verdict === 'allowed')
      .map((e) => `${e.type}|${e.tool ?? e.resource ?? ''}|${e.actorId ?? ''}`),
  );
  let missing = 0;
  for (const sess of snapshot.sessions) {
    for (const t of sess.toolsCalled) {
      if (!audited.has(`tool.invoked|${t}|${sess.principalSub}`)) missing++;
    }
    for (const r of sess.resourcesRead) {
      if (!audited.has(`resource.read|${r}|${sess.principalSub}`)) missing++;
    }
  }
  return {
    toolInvocationsObserved: toolInvs,
    resourceReadsObserved: resReads,
    auditEntries: snapshot.auditTrail.length,
    missingAuditCount: missing,
    malformedEntries: Object.freeze(malformed),
    valid: missing === 0 && malformed.length === 0,
  };
}

const Params = z.object({ snapshot: McpServerSnapshotSchema.optional() });

export const P_MCP_03 = defineProbe<z.infer<typeof Params>, AuditCompletenessResult>({
  meta: {
    id: 'P-MCP-03',
    name: 'MCP audit trail completeness',
    description: 'Verifies every observed MCP tool/resource invocation has a corresponding well-formed audit entry per the 2026 MCP spec.',
    version: '0.1.0',
    category: 'provenance',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.6.2.8', 'A.6.2.7'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 10_000, memoryMaxMb: 64, cpuMaxMs: 2_000 },
    references: [{ title: '2026 MCP roadmap — structured audit logging' }],
    groundTruthFixturePath: 'src/probes/P-MCP-03.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'audit-trail', 'logging'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_03_FIXTURES.complete) as McpServerSnapshot;
    const r = runAuditCompletenessProbe(snapshot);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        toolInvs: r.toolInvocationsObserved,
        resReads: r.resourceReadsObserved,
        missing: r.missingAuditCount,
        malformed: r.malformedEntries.length,
      },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_03_FIXTURES };
