// SPDX-License-Identifier: BUSL-1.1
'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { cn } from '../lib/cn';
import { Button } from './Button';
import { Calendar } from './Calendar';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const DatePicker = ({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  ariaLabel,
}: DatePickerProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="md"
        block
        aria-label={ariaLabel ?? placeholder}
        className={cn('justify-start text-left font-normal', !value && 'text-muted-foreground', className)}
        iconLeft={<CalendarIcon />}
      >
        {value ? format(value, 'PPP') : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={onChange as never} />
    </PopoverContent>
  </Popover>
);

export const DateRangePicker = ({
  value,
  onChange,
  placeholder = 'Select range',
  className,
}: {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="md"
        block
        className={cn('justify-start text-left font-normal', !value?.from && 'text-muted-foreground', className)}
        iconLeft={<CalendarIcon />}
      >
        {value?.from ? (
          value.to ? (
            <>
              {format(value.from, 'LLL d, y')} – {format(value.to, 'LLL d, y')}
            </>
          ) : (
            format(value.from, 'LLL d, y')
          )
        ) : (
          placeholder
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="range" selected={value} onSelect={onChange as never} numberOfMonths={2} />
    </PopoverContent>
  </Popover>
);
