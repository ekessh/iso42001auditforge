// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * SystemSuggestion — chat-stream message card representing the engine's
 * next recommended question.
 *
 * Per v3 §15.11:
 *  - subtle background (muted), left-aligned
 *  - body = the suggested question text
 *  - small provenance footer ("From A.7.4 + RAG profile, Q-A7-004 v3")
 *  - inline actions: Accept & Ask, Edit, Skip, Why this?
 *  - keyboard: Tab to focus, Enter to accept, Esc to skip
 *  - aria-live="polite" announce target on the parent stream so screen
 *    readers receive the question text + provenance the moment it arrives
 *  - Optional ShowReasoningPanel disclosure when a reasoning trace is
 *    attached (reasoning-tier model)
 */

import { Check, Edit2, HelpCircle, X } from 'lucide-react';
import * as React from 'react';

import type {
  ProvenanceLink,
  ReasoningTrace,
} from '@/lib/mocks/workspace-mock';

import { ShowReasoningPanel } from './ShowReasoningPanel';
import { WhyThisPanel } from './WhyThisPanel';

export interface SystemSuggestionProps {
  id: string;
  index: number;
  label: string;
  body: string;
  provenance: ProvenanceLink[];
  rationale: string;
  reasoningTrace?: ReasoningTrace | undefined;
  modelBadge?: string | undefined;
  whyOpen: boolean;
  reasoningOpen: boolean;
  onWhyToggle: () => void;
  onReasoningToggle: () => void;
  onAccept: () => void;
  onEdit: () => void;
  onSkip: () => void;
}

/**
 * Renders the inline provenance line, e.g.
 * "From A.7.4 Quality of data + Library Q-A7-004 v3 · coverage gap on A.6.2.7"
 */
function ProvenanceFooter({ links }: { links: ProvenanceLink[] }) {
  return (
    <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
      <span aria-hidden>From </span>
      <span className="sr-only">Sourced from </span>
      {links.map((p, i) => (
        <React.Fragment key={p.id}>
          {p.href ? (
            <a
              href={p.href}
              className="text-info underline decoration-dotted underline-offset-2 hover:text-info/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {p.label}
            </a>
          ) : (
            <span className="text-foreground/80">{p.label}</span>
          )}
          {i < links.length - 1 ? <span aria-hidden> · </span> : null}
        </React.Fragment>
      ))}
    </p>
  );
}

export function SystemSuggestion({
  id,
  index,
  label,
  body,
  provenance,
  rationale,
  reasoningTrace,
  modelBadge,
  whyOpen,
  reasoningOpen,
  onWhyToggle,
  onReasoningToggle,
  onAccept,
  onEdit,
  onSkip,
}: SystemSuggestionProps) {
  const whyId = `${id}-why`;
  const reasoningId = `${id}-reasoning`;

  // Screen-reader summary so the question + provenance are announced together
  // when the message slides in (parent <ol> uses aria-live="polite").
  const srAnnouncement = `${label}. ${body} Sourced from ${provenance.map((p) => p.label).join(', ')}.`;

  return (
    <article
      role="article"
      aria-labelledby={`${id}-label`}
      data-suggestion-index={index}
      className="rounded-lg border border-border bg-card p-3.5 shadow-xs focus-within:border-ring/50 motion-safe:animate-slide-up"
    >
      <span className="sr-only">{srAnnouncement}</span>
      <div className="flex items-start justify-between gap-2">
        <div
          id={`${id}-label`}
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </div>
        {modelBadge ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {modelBadge}
          </span>
        ) : null}
      </div>

      <p
        className="mt-1.5 text-sm leading-relaxed text-foreground"
        aria-hidden={false}
      >
        {body}
      </p>

      <ProvenanceFooter links={provenance} />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Suggestion actions">
        <button
          type="button"
          onClick={onAccept}
          data-suggestion-primary
          className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-xs font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Check className="size-3" aria-hidden /> Accept &amp; ask
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Edit2 className="size-3" aria-hidden /> Edit
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" aria-hidden /> Skip
        </button>
        <button
          type="button"
          onClick={onWhyToggle}
          aria-expanded={whyOpen}
          aria-controls={whyId}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="size-3" aria-hidden /> Why this?
        </button>
      </div>

      <WhyThisPanel
        open={whyOpen}
        rationale={rationale}
        provenance={provenance}
        panelId={whyId}
      />

      {reasoningTrace ? (
        <ShowReasoningPanel
          trace={reasoningTrace}
          open={reasoningOpen}
          onToggle={onReasoningToggle}
          panelId={reasoningId}
        />
      ) : null}
    </article>
  );
}
