// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ChatStream — left-pane scroll surface for the audit conversation.
 *
 * Renders a heterogeneous list of System Suggestion / Auditor / Auditee /
 * Inline Alert messages. Wraps the list in a polite live region so new
 * suggestions are announced; assertive contradictions/terminations
 * announce themselves via their own role="alert".
 *
 * Auto-scrolls to the bottom on new messages unless the user has scrolled
 * away (preserves their reading position).
 */

import * as React from 'react';

import type { ConversationMessage } from '@/lib/mocks/workspace-mock';
import { useWorkspaceStore } from '@/lib/store/workspace-store';

import { AuditeeAnswer } from './AuditeeAnswer';
import { AuditorMessage } from './AuditorMessage';
import { InlineAlert } from './InlineAlert';
import { SystemSuggestion } from './SystemSuggestion';

export interface ChatStreamProps {
  messages: ConversationMessage[];
  onAcceptSuggestion: (id: string) => void;
  onEditSuggestion: (id: string) => void;
  onSkipSuggestion: (id: string) => void;
  onInjectFollowup: (id: string) => void;
}

export function ChatStream({
  messages,
  onAcceptSuggestion,
  onEditSuggestion,
  onSkipSuggestion,
  onInjectFollowup,
}: ChatStreamProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stickToBottom = React.useRef(true);
  const whyOpen = useWorkspaceStore((s) => s.whyOpen);
  const reasoningOpen = useWorkspaceStore((s) => s.reasoningOpen);
  const toggleWhy = useWorkspaceStore((s) => s.toggleWhy);
  const toggleReasoning = useWorkspaceStore((s) => s.toggleReasoning);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 80;
  };

  React.useEffect(() => {
    if (!stickToBottom.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Use rAF so layout has settled before scrolling (avoids CLS on slide-in).
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length]);

  // index is the suggestion-only index (used for Tab navigation order).
  let suggestionIndex = 0;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4"
      // Polite announcer for new suggestions / messages. Assertive role="alert"
      // is owned by InlineAlert components themselves.
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Audit conversation"
    >
      <ol className="mx-auto flex max-w-[78ch] flex-col gap-3">
        {messages.map((m) => {
          if (m.kind === 'system_suggestion') {
            const idx = suggestionIndex++;
            return (
              <li key={m.id}>
                <SystemSuggestion
                  id={m.id}
                  index={idx}
                  label={m.label}
                  body={m.body}
                  provenance={m.provenance}
                  rationale={m.rationale}
                  reasoningTrace={m.reasoningTrace}
                  modelBadge={m.modelBadge}
                  whyOpen={!!whyOpen[m.id]}
                  reasoningOpen={!!reasoningOpen[m.id]}
                  onWhyToggle={() => toggleWhy(m.id)}
                  onReasoningToggle={() => toggleReasoning(m.id)}
                  onAccept={() => onAcceptSuggestion(m.id)}
                  onEdit={() => onEditSuggestion(m.id)}
                  onSkip={() => onSkipSuggestion(m.id)}
                />
              </li>
            );
          }
          if (m.kind === 'auditor_message') {
            return (
              <li key={m.id}>
                <AuditorMessage
                  body={m.body}
                  ts={m.ts}
                  auditorName={m.auditorName}
                  intervieweeName={m.intervieweeName}
                  intervieweeRole={m.intervieweeRole}
                />
              </li>
            );
          }
          if (m.kind === 'auditee_answer') {
            return (
              <li key={m.id}>
                <AuditeeAnswer
                  body={m.body}
                  ts={m.ts}
                  speakerName={m.speakerName}
                  source={m.source}
                />
              </li>
            );
          }
          // inline_alert
          return (
            <li key={m.id}>
              <InlineAlert
                kind={m.alertKind}
                what={m.what}
                remediation={m.remediation}
                onAction={() => onInjectFollowup(m.id)}
                actionLabel={m.alertKind === 'coverage_gap' ? 'Inject follow-up' : undefined}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
