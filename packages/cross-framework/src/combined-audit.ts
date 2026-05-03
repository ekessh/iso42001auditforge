// SPDX-License-Identifier: BUSL-1.1
import type { Framework, FrameworkNode } from './domain.js';
import type { MappingRegistry } from './registry.js';

export interface CombinedAuditTagging {
  primaryNode: FrameworkNode;
  tags: FrameworkNode[];
}

export function tagWorkingPaper(node: FrameworkNode, frameworks: Framework[], registry: MappingRegistry): CombinedAuditTagging {
  const tags: FrameworkNode[] = [];
  for (const fw of frameworks) {
    const mapped = registry.traverse(node, fw);
    tags.push(...mapped);
  }
  return { primaryNode: node, tags };
}
