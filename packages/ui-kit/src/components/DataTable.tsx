// SPDX-License-Identifier: BUSL-1.1
'use client';

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  /** Enable virtualization for large datasets. */
  virtualized?: boolean;
  /** Estimated row height in px. Defaults to density-aware. */
  rowHeight?: number;
  /** Density token. */
  density?: 'comfortable' | 'compact';
  /** Empty state component. */
  emptyState?: React.ReactNode;
  /** Optional row click handler. */
  onRowClick?: (row: TData) => void;
  /** Stable row key extractor. */
  getRowId?: (row: TData, index: number) => string;
  /** Aria-label for the underlying table. */
  ariaLabel?: string;
  /** Additional className. */
  className?: string;
  /** Sticky header (defaults to true). */
  stickyHeader?: boolean;
}

export function DataTable<TData>({
  data,
  columns,
  loading,
  virtualized = false,
  rowHeight,
  density = 'comfortable',
  emptyState,
  onRowClick,
  getRowId,
  ariaLabel,
  className,
  stickyHeader = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [filters, setFilters] = React.useState<ColumnFiltersState>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId,
  });

  const resolvedRowHeight = rowHeight ?? (density === 'compact' ? 36 : 44);
  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => resolvedRowHeight,
    overscan: 8,
  });

  const showVirtual = virtualized && rows.length > 50;

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      <div
        ref={containerRef}
        className={cn('relative w-full flex-1 overflow-auto', showVirtual && 'h-full')}
      >
        <table
          aria-label={ariaLabel}
          aria-rowcount={rows.length}
          className="w-full caption-bottom text-sm"
          data-density={density}
        >
          <thead
            className={cn(
              'bg-muted/60 backdrop-blur',
              stickyHeader && 'sticky top-0 z-10',
            )}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDir === 'asc'
                          ? 'ascending'
                          : sortDir === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                      className={cn(
                        'h-9 px-3 text-left align-middle text-2xs font-medium uppercase tracking-wide text-muted-foreground',
                        canSort && 'cursor-pointer select-none',
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <div className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="size-3" aria-hidden />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="size-3" aria-hidden />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-50" aria-hidden />
                            )
                          ) : null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {loading ? (
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {table.getAllLeafColumns().map((col) => (
                    <td key={col.id} className="px-3 py-2.5">
                      <Skeleton className="h-3 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : showVirtual ? (
            <tbody
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: 'relative',
                display: 'block',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vRow) => {
                const row = rows[vRow.index];
                if (!row) return null;
                return (
                  <tr
                    key={row.id}
                    data-index={vRow.index}
                    className={cn(
                      'absolute left-0 flex w-full items-center border-b border-border hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                    )}
                    style={{
                      transform: `translateY(${vRow.start}px)`,
                      height: resolvedRowHeight,
                    }}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="flex h-full items-center px-3 text-sm"
                        style={{
                          width: cell.column.getSize(),
                          flex: cell.column.getSize() ? '0 0 auto' : '1 1 0',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ) : (
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getAllLeafColumns().length}
                    className="px-3 py-8 text-center"
                  >
                    {emptyState ?? (
                      <EmptyState
                        title="No records"
                        description="Adjust filters or create a new entry."
                        size="sm"
                      />
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    aria-rowindex={index + 2}
                    className={cn(
                      'border-b border-border transition-colors hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 align-middle',
                          density === 'compact' ? 'py-1.5 text-xs' : 'py-2.5 text-sm',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

/** Re-export so apps can write column defs without an extra dependency line. */
export type { ColumnDef } from '@tanstack/react-table';
