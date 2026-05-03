// SPDX-License-Identifier: BUSL-1.1
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const LoadingScreen = ({
  label = 'Loading workspace',
  description,
  className,
}: {
  label?: string;
  description?: string;
  className?: string;
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    className={cn(
      'flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground',
      className,
    )}
  >
    <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description ? <p className="text-xs">{description}</p> : null}
    </div>
    <span className="sr-only">Loading…</span>
  </div>
);
