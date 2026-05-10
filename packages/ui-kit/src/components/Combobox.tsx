// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  ({ options, value, onChange, placeholder = 'Select…', emptyMessage = 'No matches', className, ariaLabel, disabled }, ref) => {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel ?? placeholder}
            disabled={disabled}
            className={cn(
              'flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronDown className="size-4 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <CommandPrimitive className="flex flex-col" loop>
            <div className="flex items-center border-b border-border px-3">
              <CommandPrimitive.Input
                placeholder={`Search ${placeholder.toLowerCase()}…`}
                className="h-9 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-4 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </CommandPrimitive.Empty>
              {options.map((opt) => (
                <CommandPrimitive.Item
                  key={opt.value}
                  value={`${opt.label} ${opt.value}`}
                  {...(opt.disabled !== undefined ? { disabled: opt.disabled } : {})}
                  onSelect={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                    'aria-selected:bg-muted data-[selected=true]:bg-muted',
                    'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
                  )}
                >
                  <Check
                    className={cn('mt-0.5 size-3.5 shrink-0', opt.value === value ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  <span className="flex flex-col leading-tight">
                    <span>{opt.label}</span>
                    {opt.description ? (
                      <span className="text-2xs text-muted-foreground">{opt.description}</span>
                    ) : null}
                  </span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverContent>
      </Popover>
    );
  },
);
Combobox.displayName = 'Combobox';

export const MultiSelect = ({
  options,
  values,
  onChange,
  placeholder = 'Select…',
  className,
}: {
  options: ComboboxOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [open, setOpen] = React.useState(false);
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
            className,
          )}
        >
          {values.length === 0 ? (
            <span className="px-1 text-muted-foreground">{placeholder}</span>
          ) : (
            values.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex h-6 items-center rounded bg-muted px-1.5 text-xs text-foreground"
                >
                  {opt?.label ?? v}
                </span>
              );
            })
          )}
          <ChevronDown className="ml-auto size-4 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <CommandPrimitive className="flex flex-col" loop>
          <div className="border-b border-border px-3">
            <CommandPrimitive.Input
              placeholder="Search…"
              className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
            <CommandPrimitive.Empty className="py-4 text-center text-xs text-muted-foreground">
              No matches
            </CommandPrimitive.Empty>
            {options.map((opt) => (
              <CommandPrimitive.Item
                key={opt.value}
                value={`${opt.label} ${opt.value}`}
                onSelect={() => toggle(opt.value)}
                className={cn(
                  'flex cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
                  'aria-selected:bg-muted data-[selected=true]:bg-muted',
                )}
              >
                <Check
                  className={cn('mt-0.5 size-3.5 shrink-0', values.includes(opt.value) ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span>{opt.label}</span>
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
};
