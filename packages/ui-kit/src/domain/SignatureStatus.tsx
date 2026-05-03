// SPDX-License-Identifier: BUSL-1.1
import { Clock, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export type SignatureState = 'verified' | 'pending' | 'broken' | 'unsigned';

const cfg: Record<
  SignatureState,
  { label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; tone: string }
> = {
  verified: { label: 'Signature verified', icon: ShieldCheck, tone: 'text-success' },
  pending: { label: 'Awaiting signature', icon: Clock, tone: 'text-warning' },
  broken: { label: 'Signature broken', icon: ShieldAlert, tone: 'text-destructive' },
  unsigned: { label: 'Unsigned', icon: ShieldQuestion, tone: 'text-muted-foreground' },
};

export interface SignatureStatusProps {
  state: SignatureState;
  signedBy?: string;
  signedAt?: string;
  className?: string;
}

export const SignatureStatus = ({ state, signedBy, signedAt, className }: SignatureStatusProps) => {
  const c = cfg[state];
  const Icon = c.icon;
  return (
    <div
      role="status"
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', c.tone)} aria-hidden />
      <div className="flex flex-col leading-tight">
        <span className={cn('font-medium', c.tone)}>{c.label}</span>
        {signedBy ? (
          <span className="text-2xs text-muted-foreground">
            {signedBy}
            {signedAt ? ` · ${signedAt}` : ''}
          </span>
        ) : null}
      </div>
    </div>
  );
};
