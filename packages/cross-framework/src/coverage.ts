// SPDX-License-Identifier: BUSL-1.1
import type { Framework, FrameworkNode } from './domain.js';
import type { MappingRegistry } from './registry.js';

export interface WpVerdictRef {
  source: FrameworkNode;
  verdict: 'conformant' | 'minor_nc' | 'major_nc' | 'ofi' | 'na';
}

export interface CoverageResult {
  targetFramework: Framework;
  totalTargetNodes: number;
  coveredTargetNodes: number;
  coveragePercent: number;
  uncovered: FrameworkNode[];
}

export function computeCoverage(opts: {
  targetFramework: Framework;
  targetUniverse: FrameworkNode[];
  verdicts: WpVerdictRef[];
  registry: MappingRegistry;
}): CoverageResult {
  const covered = new Set<string>();
  for (const v of opts.verdicts) {
    if (v.verdict === 'na') continue;
    const transitive = opts.registry.traverse(v.source, opts.targetFramework);
    for (const node of transitive) covered.add(`${node.framework}:${node.nodeId}`);
    if (v.source.framework === opts.targetFramework) {
      covered.add(`${v.source.framework}:${v.source.nodeId}`);
    }
  }
  const uncovered = opts.targetUniverse.filter((n) => !covered.has(`${n.framework}:${n.nodeId}`));
  const totalTarget = opts.targetUniverse.length;
  const coveredCount = totalTarget - uncovered.length;
  return {
    targetFramework: opts.targetFramework,
    totalTargetNodes: totalTarget,
    coveredTargetNodes: coveredCount,
    coveragePercent: totalTarget > 0 ? (coveredCount / totalTarget) * 100 : 0,
    uncovered,
  };
}
