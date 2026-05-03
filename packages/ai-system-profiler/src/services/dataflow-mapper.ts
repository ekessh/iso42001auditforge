// SPDX-License-Identifier: BUSL-1.1
import {
  AiSystemDataFlowSchema,
  type AiSystemDataFlow,
  type DataClassification,
  type DataFlowNode,
} from '../types/dataflow.js';
import { emptyReport, type ValidationReport, type ValidationIssue } from '../types/validation.js';

export interface DataFlowAnalysis {
  /** Topological order, empty if cycles were detected. */
  topoOrder: readonly string[];
  cycles: readonly (readonly string[])[];
  /** Sources without an upstream edge — "ingress". */
  orphanSources: readonly string[];
  /** Sinks without an inbound edge. */
  orphanSinks: readonly string[];
  /** Per-node retention compliance assessment per A.7.5. */
  retentionFindings: readonly RetentionFinding[];
}

export interface RetentionFinding {
  nodeId: string;
  classifications: readonly DataClassification[];
  retentionDays: number | undefined;
  /** Recommended max retention for the highest classification on the node. */
  recommendedMaxDays: number;
  status: 'compliant' | 'over_retained' | 'unspecified';
  rationale: string;
}

/**
 * Recommended maximum retention (days) by classification. Heuristic — used
 * to flag obvious A.7.5 issues; auditors override per engagement.
 */
const RETENTION_LIMITS: Readonly<Record<DataClassification, number>> = {
  public: 3650,
  internal: 1095,
  confidential: 730,
  restricted: 365,
  pii: 365,
  phi: 365,
  biometric: 90,
  children: 30,
  special_category_gdpr: 90,
};

function highestSeverityLimit(classifications: readonly DataClassification[]): number {
  if (classifications.length === 0) return RETENTION_LIMITS.internal;
  return classifications
    .map((c) => RETENTION_LIMITS[c])
    .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
}

/**
 * Detect simple cycles (Tarjan's SCC). Returns SCCs of size >= 2 or
 * self-loops as "cycles" suitable for a UI to render.
 */
function tarjanSCC(nodes: readonly string[], adj: ReadonlyMap<string, string[]>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const sccs: string[][] = [];

  const strongconnect = (v: string): void => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      sccs.push(comp);
    }
  };

  for (const n of nodes) if (!idx.has(n)) strongconnect(n);
  return sccs;
}

function topoOrder(nodes: readonly string[], adj: ReadonlyMap<string, string[]>): string[] | null {
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n, 0);
  for (const [, outs] of adj) for (const o of outs) indeg.set(o, (indeg.get(o) ?? 0) + 1);
  const q: string[] = [];
  for (const [n, d] of indeg) if (d === 0) q.push(n);
  const out: string[] = [];
  while (q.length > 0) {
    const n = q.shift()!;
    out.push(n);
    for (const m of adj.get(n) ?? []) {
      const nd = (indeg.get(m) ?? 0) - 1;
      indeg.set(m, nd);
      if (nd === 0) q.push(m);
    }
  }
  return out.length === nodes.length ? out : null;
}

/**
 * DataFlowMapper — validates an AI system data-flow graph and assesses
 * retention compliance against ISO/IEC 42001 Annex A.7.
 */
export class DataFlowMapper {
  /**
   * Validate a data-flow graph: structural Zod parse, then reachability,
   * cycle detection, retention assessment.
   */
  validate(flow: AiSystemDataFlow): { report: ValidationReport; analysis?: DataFlowAnalysis } {
    const report = emptyReport('data-flow');
    const parsed = AiSystemDataFlowSchema.safeParse(flow);
    if (!parsed.success) {
      report.rejectedCount = 1;
      for (const issue of parsed.error.issues) {
        const v: ValidationIssue = {
          level: 'error',
          code: issue.code,
          message: issue.message,
          path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
        };
        report.issues.push(v);
      }
      return { report };
    }
    const data = parsed.data;
    const adj = new Map<string, string[]>();
    const nodeIds = data.nodes.map((n) => n.id);
    for (const id of nodeIds) adj.set(id, []);
    for (const e of data.edges) adj.get(e.from)?.push(e.to);

    const sccs = tarjanSCC(nodeIds, adj);
    const cycles = sccs.filter(
      (c) => c.length > 1 || (c.length === 1 && (adj.get(c[0]!) ?? []).includes(c[0]!)),
    );
    const order = cycles.length === 0 ? topoOrder(nodeIds, adj) ?? [] : [];

    if (cycles.length > 0) {
      report.issues.push({
        level: 'error',
        code: 'DATAFLOW_CYCLE',
        message: `Cycle detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`,
        path: ['edges'],
      });
      report.rejectedCount += cycles.length;
    }

    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    for (const n of nodeIds) {
      incoming.set(n, 0);
      outgoing.set(n, 0);
    }
    for (const e of data.edges) {
      outgoing.set(e.from, (outgoing.get(e.from) ?? 0) + 1);
      incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
    }
    const orphanSources: string[] = [];
    const orphanSinks: string[] = [];
    for (const node of data.nodes) {
      if (node.kind === 'source' && (incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) === 0) {
        orphanSources.push(node.id);
        report.issues.push({
          level: 'warning',
          code: 'DATAFLOW_ORPHAN_SOURCE',
          message: `Source "${node.id}" has no edges`,
          path: ['nodes', node.id],
        });
      }
      if (node.kind === 'sink' && (incoming.get(node.id) ?? 0) === 0) {
        orphanSinks.push(node.id);
        report.issues.push({
          level: 'warning',
          code: 'DATAFLOW_ORPHAN_SINK',
          message: `Sink "${node.id}" receives no data`,
          path: ['nodes', node.id],
        });
      }
    }

    const retentionFindings: RetentionFinding[] = data.nodes.map((node) =>
      this.assessRetention(node, report),
    );

    report.acceptedCount = nodeIds.length - report.rejectedCount;

    return {
      report,
      analysis: {
        topoOrder: order,
        cycles,
        orphanSources,
        orphanSinks,
        retentionFindings,
      },
    };
  }

  private assessRetention(node: DataFlowNode, report: ValidationReport): RetentionFinding {
    const limit = highestSeverityLimit(node.classifications);
    if (node.classifications.length === 0) {
      return {
        nodeId: node.id,
        classifications: [],
        ...(node.retentionDays !== undefined ? { retentionDays: node.retentionDays } : { retentionDays: undefined }),
        recommendedMaxDays: limit,
        status: 'unspecified',
        rationale: 'No classification labels — retention compliance cannot be assessed',
      };
    }
    if (node.retentionDays === undefined) {
      report.issues.push({
        level: 'warning',
        code: 'DATAFLOW_RETENTION_UNSET',
        message: `Node "${node.id}" has classifications ${node.classifications.join(',')} but no retentionDays`,
        path: ['nodes', node.id, 'retentionDays'],
      });
      return {
        nodeId: node.id,
        classifications: node.classifications,
        retentionDays: undefined,
        recommendedMaxDays: limit,
        status: 'unspecified',
        rationale: `Set retention <= ${limit} days for highest classification`,
      };
    }
    if (node.retentionDays > limit) {
      report.issues.push({
        level: 'error',
        code: 'DATAFLOW_RETENTION_EXCEEDED',
        message: `Node "${node.id}" retains ${node.retentionDays}d > recommended ${limit}d`,
        path: ['nodes', node.id, 'retentionDays'],
      });
      return {
        nodeId: node.id,
        classifications: node.classifications,
        retentionDays: node.retentionDays,
        recommendedMaxDays: limit,
        status: 'over_retained',
        rationale: `Annex A.7.5: retention exceeds limit for ${node.classifications.join(',')}`,
      };
    }
    return {
      nodeId: node.id,
      classifications: node.classifications,
      retentionDays: node.retentionDays,
      recommendedMaxDays: limit,
      status: 'compliant',
      rationale: `Within recommended limit of ${limit} days`,
    };
  }
}
