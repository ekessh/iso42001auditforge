// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export interface TimelineEvent {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** ISO timestamp displayed on the right. */
  timestamp?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  meta?: React.ReactNode;
}

export const Timeline = ({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) => (
  <ol className={cn('relative space-y-3 border-l border-border pl-5', className)}>
    {events.map((evt) => (
      <li key={evt.id} className="relative">
        <span
          aria-hidden
          className={cn(
            'absolute -left-[26px] top-1.5 flex size-4 items-center justify-center rounded-full ring-4 ring-card [&_svg]:size-2.5',
            !evt.tone || evt.tone === 'neutral' ? 'bg-muted text-muted-foreground' : '',
            evt.tone === 'primary' && 'bg-primary text-primary-foreground',
            evt.tone === 'success' && 'bg-success text-success-foreground',
            evt.tone === 'warning' && 'bg-warning text-warning-foreground',
            evt.tone === 'danger' && 'bg-destructive text-destructive-foreground',
            evt.tone === 'info' && 'bg-info text-info-foreground',
          )}
        >
          {evt.icon}
        </span>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{evt.title}</p>
          {evt.timestamp ? (
            <time className="font-mono text-2xs text-muted-foreground" dateTime={evt.timestamp}>
              {evt.timestamp}
            </time>
          ) : null}
        </div>
        {evt.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{evt.description}</p>
        ) : null}
        {evt.meta ? <div className="mt-1.5">{evt.meta}</div> : null}
      </li>
    ))}
  </ol>
);
