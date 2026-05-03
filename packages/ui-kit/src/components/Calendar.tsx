// SPDX-License-Identifier: BUSL-1.1
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '../lib/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({ className, classNames, showOutsideDays = true, ...rest }: CalendarProps) => (
  <DayPicker
    showOutsideDays={showOutsideDays}
    className={cn('p-3', className)}
    classNames={{
      months: 'flex flex-col sm:flex-row gap-4',
      month: 'space-y-3',
      month_caption: 'flex justify-center pt-1 relative items-center text-sm font-medium',
      nav: 'flex items-center gap-1',
      button_previous:
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      button_next:
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      table: 'w-full border-collapse space-y-1',
      weekdays: 'flex',
      weekday: 'text-muted-foreground rounded-md w-8 font-normal text-2xs',
      week: 'flex w-full mt-1',
      day: 'h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-muted',
      day_button:
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs hover:bg-muted aria-selected:bg-primary aria-selected:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected: 'bg-primary text-primary-foreground',
      today: 'bg-accent text-accent-foreground rounded-md',
      outside: 'text-muted-foreground/50',
      disabled: 'text-muted-foreground/40',
      range_middle: 'bg-muted',
      hidden: 'invisible',
      ...classNames,
    }}
    components={{
      Chevron: ({ orientation }) =>
        orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
    }}
    {...rest}
  />
);
