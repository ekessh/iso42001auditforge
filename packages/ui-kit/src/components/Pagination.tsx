// SPDX-License-Identifier: BUSL-1.1
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = ({ page, pageCount, onPageChange, className }: PaginationProps) => {
  const pages = React.useMemo(() => buildPages(page, pageCount), [page, pageCount]);
  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-2', className)}
    >
      <Button
        variant="ghost"
        size="sm"
        iconLeft={<ChevronLeft />}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <ul className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === '...' ? (
            <li key={`gap-${i}`} className="px-2 text-xs text-muted-foreground" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular',
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        iconRight={<ChevronRight />}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
};

function buildPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: (number | '...')[] = [1];
  if (current > 4) result.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) result.push(i);
  if (current < total - 3) result.push('...');
  result.push(total);
  return result;
}
