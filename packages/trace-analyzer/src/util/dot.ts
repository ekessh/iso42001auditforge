// SPDX-License-Identifier: BUSL-1.1
//
// Tiny Graphviz DOT renderer. We deliberately avoid a dependency for this:
// the surface area we need (digraph, labelled nodes, labelled edges,
// quoting) is ~30 lines.

export interface DotNode {
  id: string;
  label: string;
  shape?: string;
  fillcolor?: string;
}

export interface DotEdge {
  from: string;
  to: string;
  label?: string;
}

/** Quote a value for DOT — escape backslashes and double quotes. */
function quote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function renderDot(
  graphName: string,
  nodes: readonly DotNode[],
  edges: readonly DotEdge[],
): string {
  const lines: string[] = [];
  lines.push(`digraph ${quote(graphName)} {`);
  lines.push('  rankdir=LR;');
  for (const n of nodes) {
    const attrs: string[] = [`label=${quote(n.label)}`];
    if (n.shape) attrs.push(`shape=${quote(n.shape)}`);
    if (n.fillcolor) {
      attrs.push('style=filled', `fillcolor=${quote(n.fillcolor)}`);
    }
    lines.push(`  ${quote(n.id)} [${attrs.join(', ')}];`);
  }
  for (const e of edges) {
    const attrs: string[] = [];
    if (e.label) attrs.push(`label=${quote(e.label)}`);
    const tail = attrs.length ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  ${quote(e.from)} -> ${quote(e.to)}${tail};`);
  }
  lines.push('}');
  return lines.join('\n');
}
