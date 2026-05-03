// SPDX-License-Identifier: BUSL-1.1
import { Beaker, Clock, Sparkle } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Badge } from '../components/Badge';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Progress } from '../components/Progress';

export interface ProbeResultCardProps {
  probeId: string;
  probeName: string;
  category: string;
  /** 0–100 score. */
  score?: number;
  pass?: boolean;
  /** Run mode. */
  mode: 'offline' | 'live' | 'replay';
  duration?: string;
  cost?: string;
  llmBackend?: 'local' | 'cloud';
  description?: React.ReactNode;
  meta?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const ProbeResultCard = ({
  probeId,
  probeName,
  category,
  score,
  pass,
  mode,
  duration,
  cost,
  llmBackend,
  description,
  meta,
  onClick,
  className,
}: ProbeResultCardProps) => {
  const tone = pass ? 'success' : score !== undefined && score < 50 ? 'danger' : 'warning';
  return (
    <Card
      interactive={Boolean(onClick)}
      className={cn('w-full', className)}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <code className="font-mono text-2xs tabular text-muted-foreground">{probeId}</code>
            <h3 className="mt-0.5 truncate text-sm font-semibold">{probeName}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'warning'}>
              {pass ? 'PASS' : score !== undefined && score < 50 ? 'FAIL' : 'REVIEW'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge tone="primary" size="xs">
            <Beaker /> {category}
          </Badge>
          <Badge tone="neutral" size="xs">
            {mode}
          </Badge>
          {llmBackend ? (
            <Badge tone={llmBackend === 'local' ? 'success' : 'info'} size="xs">
              <Sparkle /> {llmBackend === 'local' ? 'local-LLM' : 'cloud-LLM'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {score !== undefined ? (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Score</span>
              <span className="font-mono tabular font-semibold">{score.toFixed(1)}</span>
            </div>
            <Progress value={score} tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'warning'} />
          </div>
        ) : null}
        {description ? <p className="text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-2xs tabular text-muted-foreground">
          {duration ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden /> {duration}
            </span>
          ) : null}
          {cost ? <span>{cost}</span> : null}
        </div>
        {meta ? <div className="pt-1">{meta}</div> : null}
      </CardContent>
    </Card>
  );
};
