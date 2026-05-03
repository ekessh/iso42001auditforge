// SPDX-License-Identifier: BUSL-1.1
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export type StepperState = 'pending' | 'active' | 'complete' | 'error';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  state?: StepperState;
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepperStep[];
  orientation?: 'horizontal' | 'vertical';
  current?: number;
}

export const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  ({ steps, orientation = 'horizontal', current, className, ...rest }, ref) => (
    <ol
      ref={ref}
      role="list"
      aria-label="Progress"
      className={cn(
        orientation === 'horizontal'
          ? 'flex w-full items-start gap-2'
          : 'flex flex-col gap-3',
        className,
      )}
      {...rest}
    >
      {steps.map((step, index) => {
        const state =
          step.state ??
          (current !== undefined
            ? index < current
              ? 'complete'
              : index === current
                ? 'active'
                : 'pending'
            : 'pending');
        return (
          <li
            key={step.id}
            className={cn(
              'relative flex',
              orientation === 'horizontal' ? 'flex-1 items-start gap-2' : 'gap-3',
            )}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1 ring-inset',
                state === 'complete' && 'bg-success text-success-foreground ring-success',
                state === 'active' && 'bg-primary text-primary-foreground ring-primary',
                state === 'pending' && 'bg-muted text-muted-foreground ring-border',
                state === 'error' && 'bg-destructive text-destructive-foreground ring-destructive',
              )}
              aria-hidden
            >
              {state === 'complete' ? <Check className="size-3" /> : index + 1}
            </span>
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  'text-sm font-medium',
                  state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-2xs text-muted-foreground">{step.description}</span>
              ) : null}
            </div>
            {orientation === 'horizontal' && index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-7 top-3 h-px w-full -translate-y-1/2',
                  state === 'complete' ? 'bg-success' : 'bg-border',
                )}
                style={{ width: 'calc(100% - 2rem)' }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  ),
);
Stepper.displayName = 'Stepper';
