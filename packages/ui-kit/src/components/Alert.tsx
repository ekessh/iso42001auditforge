// SPDX-License-Identifier: BUSL-1.1
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

const alertVariants = cva(
  'relative w-full rounded-md border p-3 pl-10 text-sm [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg]:size-4',
  {
    variants: {
      tone: {
        info: 'border-info/30 bg-info/10 text-info-foreground [&>svg]:text-info',
        success:
          'border-success/30 bg-success/10 text-success-foreground [&>svg]:text-success',
        warning:
          'border-warning/40 bg-warning/10 text-warning [&>svg]:text-warning',
        danger:
          'border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive',
        neutral: 'border-border bg-muted text-foreground [&>svg]:text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

const iconForTone = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone = 'info', icon, children, ...rest }, ref) => {
    const Icon = iconForTone[tone ?? 'info'];
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ tone }), className)}
        {...rest}
      >
        {icon ?? <Icon aria-hidden />}
        {children}
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export const AlertTitle = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn('mb-0.5 font-semibold leading-tight', className)} {...rest} />
);

export const AlertDescription = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <div className={cn('text-xs leading-relaxed [&_p]:leading-relaxed', className)} {...rest} />
);
