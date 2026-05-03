// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * AuditeeAnswer — left-aligned chat bubble for what the auditee said.
 *
 * Per v3 §15.11 / §15.4, an answer can be pasted, dictated via local
 * Whisper, or typed by the auditor on the auditee's behalf. We show the
 * speaker label and transcription source so the audit ledger remains
 * defensible (the source provenance feeds attribution).
 */

import { Mic, Cloud, Keyboard } from 'lucide-react';
import * as React from 'react';

import type { AuditeeAnswerMessage } from '@/lib/mocks/workspace-mock';

export interface AuditeeAnswerProps {
  body: string;
  ts: string;
  speakerName: string;
  source: AuditeeAnswerMessage['source'];
}

const SOURCE_META: Record<AuditeeAnswerMessage['source'], { icon: React.ElementType; label: string }> = {
  typed: { icon: Keyboard, label: 'typed by auditor' },
  transcribed_local: { icon: Mic, label: 'transcribed locally (whisper.cpp)' },
  transcribed_cloud: { icon: Cloud, label: 'transcribed via cloud ASR' },
};

export function AuditeeAnswer({ body, ts, speakerName, source }: AuditeeAnswerProps) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <article
      className="max-w-[78ch] motion-safe:animate-slide-up"
      aria-label={`Auditee answer by ${speakerName} at ${ts}, ${meta.label}`}
    >
      <div className="inline-block rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
        {body}
      </div>
      <div className="mt-1 flex items-center gap-2 text-2xs text-muted-foreground">
        <span className="font-medium text-foreground">{speakerName}</span>
        <span aria-hidden>·</span>
        <time>{ts}</time>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3" aria-hidden />
          {meta.label}
        </span>
      </div>
    </article>
  );
}
