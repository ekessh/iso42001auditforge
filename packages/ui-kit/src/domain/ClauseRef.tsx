// SPDX-License-Identifier: BUSL-1.1
'use client';

import { ExternalLink } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Tooltip } from '../components/Tooltip';

export interface ClauseRefProps {
  clause: string;
  /** Short clause title shown in tooltip. */
  title?: string;
  /** href if the clause is browseable. */
  href?: string;
  className?: string;
}

/**
 * Clickable reference to an ISO 42001 clause (e.g. "6.1.4"). Renders monospace
 * with a tooltip preview of the clause title.
 */
export const ClauseRef = ({ clause, title, href, className }: ClauseRefProps) => {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-2xs tabular',
        href && 'cursor-pointer hover:border-ring/40 hover:bg-muted',
        className,
      )}
    >
      <span className="font-semibold text-foreground">ISO</span>
      <span className="text-muted-foreground">{clause}</span>
      {href ? <ExternalLink className="size-2.5 opacity-60" aria-hidden /> : null}
    </span>
  );
  const node = href ? (
    <a href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
      {content}
    </a>
  ) : (
    content
  );
  if (title) {
    return (
      <Tooltip label={`ISO 42001 ${clause} — ${title}`}>
        <span>{node}</span>
      </Tooltip>
    );
  }
  return node;
};

export interface ControlRefProps {
  control: string;
  title?: string;
  href?: string;
  className?: string;
}

/** Annex A.x.y control reference. */
export const ControlRef = ({ control, title, href, className }: ControlRefProps) => {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-2xs tabular text-primary',
        href && 'cursor-pointer hover:border-primary/40',
        className,
      )}
    >
      <span className="font-semibold">A.</span>
      <span>{control}</span>
    </span>
  );
  const node = href ? (
    <a href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
      {content}
    </a>
  ) : (
    content
  );
  if (title) {
    return (
      <Tooltip label={`Annex A.${control} — ${title}`}>
        <span>{node}</span>
      </Tooltip>
    );
  }
  return node;
};

export interface CrossFrameworkBadgeProps {
  framework: 'iso42001' | 'eu-ai-act' | 'nist-ai-rmf' | 'iso27001';
  reference?: string;
  className?: string;
}

const fwConfig = {
  iso42001: { label: 'ISO 42001', tone: 'bg-navy-500/10 text-navy-500 border-navy-500/30' },
  'eu-ai-act': { label: 'EU AI Act', tone: 'bg-cyan-700/10 text-cyan-700 border-cyan-700/30' },
  'nist-ai-rmf': { label: 'NIST AI RMF', tone: 'bg-violet-600/10 text-violet-600 border-violet-600/30' },
  iso27001: { label: 'ISO 27001', tone: 'bg-teal-700/10 text-teal-700 border-teal-700/30' },
} as const;

export const CrossFrameworkBadge = ({ framework, reference, className }: CrossFrameworkBadgeProps) => {
  const cfg = fwConfig[framework];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-2xs tabular',
        cfg.tone,
        className,
      )}
    >
      <span className="font-semibold">{cfg.label}</span>
      {reference ? <span className="opacity-80">{reference}</span> : null}
    </span>
  );
};
