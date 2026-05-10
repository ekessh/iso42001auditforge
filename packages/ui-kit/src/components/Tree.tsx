// SPDX-License-Identifier: BUSL-1.1
'use client';

import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface TreeNode {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  children?: TreeNode[];
  meta?: React.ReactNode;
}

export interface TreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'onSelect'> {
  nodes: TreeNode[];
  defaultExpandedIds?: string[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export const Tree = ({ nodes, defaultExpandedIds, selectedId, onSelect, className, ...rest }: TreeProps) => {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(defaultExpandedIds ?? []));
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <ul
      role="tree"
      aria-multiselectable={false}
      className={cn('text-sm', className)}
      {...rest}
    >
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          level={0}
          expanded={expanded}
          toggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
};

const TreeItem = ({
  node,
  level,
  expanded,
  toggle,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  level: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={isSelected || undefined}>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) toggle(node.id);
          onSelect?.(node.id);
        }}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected && 'bg-muted text-foreground',
        )}
        style={{ paddingLeft: 8 + level * 14 }}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            !hasChildren && 'invisible',
            isOpen && 'rotate-90',
          )}
        />
        {node.icon ? <span className="shrink-0 [&_svg]:size-3.5">{node.icon}</span> : null}
        <span className="truncate">{node.label}</span>
        {node.meta ? <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{node.meta}</span> : null}
      </button>
      {hasChildren && isOpen ? (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              toggle={toggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};
