// SPDX-License-Identifier: BUSL-1.1
//
// HumanInLoopGateVerifier: enumerates declared HITL gates in the topology
// and audits whether each gate was reached, approved, rejected, or skipped
// in the supplied traces. Skipped gates are the auditor's primary concern
// (unauthorised autonomous action).

import type { AgentTopology } from '../types/topology.js';
import type { AgentTrace } from '../types/trace.js';
import {
  HitlGateAuditReportSchema,
  type HitlGateAuditReport,
  type HitlGateOutcome,
} from '../reports/index.js';

export class HumanInLoopGateVerifier {
  verify(
    topology: AgentTopology,
    traces: readonly AgentTrace[],
  ): HitlGateAuditReport {
    const gateNodes = topology.nodes.filter((n) => n.isHitlGate);
    const outcomes: HitlGateOutcome[] = [];
    let conformant = true;

    for (const gate of gateNodes) {
      let total = 0;
      let approved = 0;
      let rejected = 0;
      let skipped = 0;
      const skippedTraceIds: string[] = [];
      for (const trace of traces) {
        // A "gate encounter" is any span whose name or attributes reference
        // the gate node id or name.
        const gateSpans = trace.spans.filter(
          (s) =>
            s.name === gate.name ||
            s.name === gate.id ||
            s.attributes['hitl.gate'] === gate.id ||
            s.attributes['hitl.gate'] === gate.name,
        );
        if (gateSpans.length === 0) continue;
        for (const gs of gateSpans) {
          total += 1;
          const escalation = trace.escalations.find(
            (e) => e.spanId === gs.spanId,
          );
          if (!escalation) {
            skipped += 1;
            if (!skippedTraceIds.includes(trace.id)) {
              skippedTraceIds.push(trace.id);
            }
            conformant = false;
            continue;
          }
          if (escalation.approved === true) approved += 1;
          else if (escalation.approved === false) rejected += 1;
          else {
            // Recorded escalation but no approval/rejection outcome — also
            // a skip from an audit perspective.
            skipped += 1;
            if (!skippedTraceIds.includes(trace.id)) {
              skippedTraceIds.push(trace.id);
            }
            conformant = false;
          }
        }
      }
      outcomes.push({
        gateId: gate.id,
        gateName: gate.name,
        totalEncounters: total,
        approved,
        rejected,
        skipped,
        skippedTraceIds,
      });
    }

    const report: HitlGateAuditReport = {
      topologyId: topology.id,
      totalTraces: traces.length,
      gates: outcomes,
      conformant: gateNodes.length === 0 ? true : conformant,
    };
    return HitlGateAuditReportSchema.parse(report);
  }
}
