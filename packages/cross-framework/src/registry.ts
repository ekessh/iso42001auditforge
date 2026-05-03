// SPDX-License-Identifier: BUSL-1.1
import type { Framework, FrameworkMapping, FrameworkNode } from './domain.js';

export class MappingRegistry {
  private byKey = new Map<string, FrameworkMapping[]>();

  constructor(initial: FrameworkMapping[] = []) {
    for (const m of initial) this.add(m);
  }

  private k(n: FrameworkNode): string { return `${n.framework}:${n.nodeId}`; }

  add(m: FrameworkMapping): void {
    const sk = this.k(m.source);
    const tk = this.k(m.target);
    this.indexAdd(sk, m);
    this.indexAdd(`__target__:${tk}`, m);
  }

  private indexAdd(key: string, m: FrameworkMapping): void {
    const arr = this.byKey.get(key);
    if (arr) arr.push(m);
    else this.byKey.set(key, [m]);
  }

  outgoing(n: FrameworkNode): FrameworkMapping[] {
    return this.byKey.get(this.k(n)) ?? [];
  }

  incoming(n: FrameworkNode): FrameworkMapping[] {
    return this.byKey.get(`__target__:${this.k(n)}`) ?? [];
  }

  traverse(start: FrameworkNode, target: Framework, maxDepth = 3): FrameworkNode[] {
    const seen = new Set<string>();
    const result: FrameworkNode[] = [];
    const visit = (node: FrameworkNode, depth: number) => {
      const key = this.k(node);
      if (seen.has(key) || depth > maxDepth) return;
      seen.add(key);
      if (node.framework === target && key !== this.k(start)) result.push(node);
      for (const edge of this.outgoing(node)) visit(edge.target, depth + 1);
    };
    visit(start, 0);
    return result;
  }

  size(): number {
    let n = 0;
    for (const arr of this.byKey.values()) n += arr.length;
    return n / 2;
  }
}
