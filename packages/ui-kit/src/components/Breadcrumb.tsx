// SPDX-License-Identifier: BUSL-1.1
import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const Breadcrumb = ({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) => (
  <nav aria-label="Breadcrumb" className={cn('text-xs', className)}>
    <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.href && !last ? (
              <a
                href={item.href}
                className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={cn(last && 'font-medium text-foreground')}
                aria-current={last ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
            {!last ? (
              <ChevronRight className="size-3 opacity-60" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  </nav>
);
