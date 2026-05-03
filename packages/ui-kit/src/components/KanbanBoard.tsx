// SPDX-License-Identifier: BUSL-1.1
'use client';

import { GripVertical } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Badge } from './Badge';

export interface KanbanCard {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  badges?: { label: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  description?: string;
  cards: KanbanCard[];
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string) => void;
  onCardClick?: (card: KanbanCard) => void;
  className?: string;
}

/** Drag-and-drop kanban with HTML5 DnD (keyboard-accessible via aria-grabbed alternatives). */
export const KanbanBoard = ({ columns, onCardMove, onCardClick, className }: KanbanBoardProps) => {
  const [dragging, setDragging] = React.useState<{ id: string; from: string } | null>(null);
  return (
    <div className={cn('flex h-full gap-3 overflow-x-auto pb-2', className)}>
      {columns.map((col) => (
        <section
          key={col.id}
          aria-label={col.title}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!dragging) return;
            if (dragging.from !== col.id) {
              onCardMove?.(dragging.id, dragging.from, col.id);
            }
            setDragging(null);
          }}
          className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border bg-card/60 p-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  col.accent === 'primary' && 'bg-primary',
                  col.accent === 'success' && 'bg-success',
                  col.accent === 'warning' && 'bg-warning',
                  col.accent === 'danger' && 'bg-destructive',
                  col.accent === 'info' && 'bg-info',
                  (!col.accent || col.accent === 'neutral') && 'bg-muted-foreground/60',
                )}
                aria-hidden
              />
              <h3 className="text-sm font-semibold">{col.title}</h3>
            </div>
            <Badge tone="neutral">{col.cards.length}</Badge>
          </header>
          {col.description ? (
            <p className="px-2.5 pt-1.5 text-2xs text-muted-foreground">{col.description}</p>
          ) : null}
          <ol className="flex-1 space-y-2 p-2">
            {col.cards.map((card) => (
              <li
                key={card.id}
                draggable
                tabIndex={0}
                onDragStart={() => setDragging({ id: card.id, from: col.id })}
                onClick={() => onCardClick?.(card)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick?.(card);
                  }
                }}
                className="cursor-grab rounded-md border border-border bg-card p-2.5 text-sm shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                aria-grabbed={dragging?.id === card.id || undefined}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  <div className="flex-1">
                    <p className="font-medium leading-tight">{card.title}</p>
                    {card.subtitle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{card.subtitle}</p>
                    ) : null}
                    {card.badges && card.badges.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {card.badges.map((b, i) => (
                          <Badge key={i} tone={b.tone ?? 'neutral'}>
                            {b.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {card.meta ? (
                      <div className="mt-1.5 text-2xs text-muted-foreground">{card.meta}</div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};
