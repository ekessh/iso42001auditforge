// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

/** Lightweight table primitives — for cases where TanStack Table is overkill. */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...rest }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...rest} />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...rest }, ref) => (
  <thead
    ref={ref}
    className={cn('bg-muted/40 [&_tr]:border-b [&_tr]:border-border', className)}
    {...rest}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...rest }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...rest}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...rest }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t border-border bg-muted/30 font-medium', className)}
    {...rest}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...rest }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border transition-colors hover:bg-muted/40',
      className,
    )}
    {...rest}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...rest }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-9 px-3 text-left align-middle text-2xs font-medium uppercase tracking-wide text-muted-foreground',
      className,
    )}
    {...rest}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...rest }, ref) => (
  <td
    ref={ref}
    className={cn('px-3 py-2.5 align-middle text-sm', className)}
    {...rest}
  />
));
TableCell.displayName = 'TableCell';
