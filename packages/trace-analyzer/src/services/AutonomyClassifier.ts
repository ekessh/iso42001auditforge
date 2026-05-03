// SPDX-License-Identifier: BUSL-1.1
//
// AutonomyClassifier: maps observed behaviour and topology features to one
// of the four ISO 42001 / AuditForge autonomy levels.
//
// Levels (from design 3.6):
// 1. suggest                — system proposes; human always acts
// 2. execute-with-approval  — system acts only after explicit human approval
// 3. execute-with-audit     — system acts; logs reviewed by human after
// 4. execute-autonomous     — system acts; no review loop required

import type { AgentTopology, AutonomyLevel } from '../types/topology.js';
import type { AgentTrace } from '../types/trace.js';
import type { AutonomyAssessment } from '../reports/index.js';
import { AutonomyLevelLabel } from '../types/topology.js';

export class AutonomyClassifier {
  classify(
    topology: AgentTopology,
    traces: readonly AgentTrace[],
  ): AutonomyAssessment {
    const signals: string[] = [];

    const declaredHitlGates = topology.nodes.filter((n) => n.isHitlGate).length;
    if (declaredHitlGates > 0) signals.push(`declared HITL gates: ${declaredHitlGates}`);

    const totalEscalations = traces.reduce(
      (acc, t) => acc + t.escalations.length,
      0,
    );
    const approvedEscalations = traces.reduce(
      (acc, t) => acc + t.escalations.filter((e) => e.approved === true).length,
      0,
    );
    const rejectedEscalations = traces.reduce(
      (acc, t) => acc + t.escalations.filter((e) => e.approved === false).length,
      0,
    );
    const writeOrDestructiveTools = topology.tools.filter(
      (t) => t.sensitivity === 'write' || t.sensitivity === 'destructive',
    ).length;
    const totalToolCalls = traces.reduce((acc, t) => acc + t.toolCalls.length, 0);
    const totalSpans = traces.reduce((acc, t) => acc + t.spans.length, 0);

    if (totalEscalations > 0) signals.push(`escalations: ${totalEscalations}`);
    if (approvedEscalations > 0)
      signals.push(`approved: ${approvedEscalations}`);
    if (rejectedEscalations > 0)
      signals.push(`rejected: ${rejectedEscalations}`);
    if (writeOrDestructiveTools > 0)
      signals.push(`write/destructive tools: ${writeOrDestructiveTools}`);
    if (totalToolCalls > 0)
      signals.push(`tool calls observed: ${totalToolCalls}`);

    let level: AutonomyLevel;
    let rationale: string;

    if (totalToolCalls === 0 && writeOrDestructiveTools === 0) {
      level = 1;
      rationale =
        'No write/destructive tools and no observed tool execution; system is suggest-only.';
    } else if (
      declaredHitlGates > 0 &&
      totalEscalations >= Math.max(1, totalSpans * 0.005) &&
      approvedEscalations + rejectedEscalations > 0
    ) {
      level = 2;
      rationale =
        'Topology declares HITL gates and traces show escalations with explicit approve/reject outcomes.';
    } else if (declaredHitlGates === 0 && writeOrDestructiveTools > 0) {
      // Logs exist (we have traces) but no human gating in design.
      level = traces.length > 0 ? 3 : 4;
      rationale =
        traces.length > 0
          ? 'No HITL gates declared, but full trace logs are available for after-the-fact audit.'
          : 'No HITL gates and no trace evidence supplied; treat as fully autonomous.';
    } else {
      level = 3;
      rationale =
        'Mixed signals — autonomous execution with audit logs but no live approval requirement.';
    }

    return {
      level,
      label: AutonomyLevelLabel[level],
      rationale,
      signals,
    };
  }
}
