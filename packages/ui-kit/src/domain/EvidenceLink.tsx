// SPDX-License-Identifier: BUSL-1.1
import {
  Camera,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Mic,
  Paperclip,
  Server,
  ShieldCheck,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export type EvidenceKind =
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'audio'
  | 'video'
  | 'screenshot'
  | 'link'
  | 'system'
  | 'probe-result';

const iconForKind: Record<EvidenceKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: ImageIcon,
  audio: Mic,
  video: Camera,
  screenshot: Camera,
  link: LinkIcon,
  system: Server,
  'probe-result': ShieldCheck,
};

export interface EvidenceLinkProps {
  kind: EvidenceKind;
  label: string;
  hash?: string;
  size?: 'sm' | 'md';
  href?: string;
  meta?: React.ReactNode;
  signed?: boolean;
  className?: string;
}

export const EvidenceLink = ({
  kind,
  label,
  hash,
  size = 'sm',
  href,
  meta,
  signed,
  className,
}: EvidenceLinkProps) => {
  const Icon = iconForKind[kind] ?? Paperclip;
  const inner = (
    <span
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm transition-colors',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        href && 'hover:border-ring/50 hover:bg-muted',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate font-medium">{label}</span>
      {hash ? (
        <code className="ml-1 rounded bg-muted/70 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
          {hash.slice(0, 7)}
        </code>
      ) : null}
      {signed ? (
        <ShieldCheck className="size-3 text-success" aria-label="Hash verified" />
      ) : null}
      {meta ? <span className="ml-1 text-2xs text-muted-foreground">{meta}</span> : null}
    </span>
  );
  if (href) {
    return (
      <a href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
        {inner}
      </a>
    );
  }
  return inner;
};
