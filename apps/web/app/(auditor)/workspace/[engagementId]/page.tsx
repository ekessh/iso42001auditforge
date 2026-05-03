// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Conversational Audit Workspace — v3 §15.11 + §15.14.
 *
 * Two-pane chat-style workbench. Header strip shows scope, mini coverage
 * dashboard underneath, left pane is the audit conversation, right pane
 * is the live findings stream. Composer at the bottom locks for ~2s
 * after each answer submit while the attribution pipeline runs.
 *
 * Keyboard shortcuts (mounted globally on this page):
 *   - Tab through suggestions, Enter accept, Esc dismiss
 *   - Cmd/Ctrl+1..9 jump to candidate finding cards
 *   - Cmd/Ctrl+E cycle composer mode
 *   - Cmd/Ctrl+L jump to Live Interview mode
 */

import { Skeleton } from '@auditforge/ui-kit';
import { use, useEffect, useMemo, useRef, useState } from 'react';

import { MiniAuditDashboard } from '@/components/dashboards/MiniAuditDashboard';
import { ChatStream } from '@/components/workspace/ChatStream';
import { Composer } from '@/components/workspace/Composer';
import { RightPane } from '@/components/workspace/RightPane';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useWorkspace } from '@/lib/hooks/use-workspace';
import {
  type AuditeeAnswerMessage,
  type ConversationMessage,
} from '@/lib/mocks/workspace-mock';
import {
  modeLabels,
  useWorkspaceStore,
  type ComposerMode,
} from '@/lib/store/workspace-store';

interface PageProps {
  params: Promise<{ engagementId: string }>;
}

const COMPOSER_ORDER: ComposerMode[] = ['question', 'live_interview', 'note'];

export default function ConversationalWorkspacePage({ params }: PageProps) {
  const { engagementId } = use(params);
  const { data, isLoading } = useWorkspace(engagementId, 'audit');

  const setContext = useWorkspaceStore((s) => s.setContext);
  const setMessages = useWorkspaceStore((s) => s.setMessages);
  const setFindings = useWorkspaceStore((s) => s.setFindings);
  const messages = useWorkspaceStore((s) => s.messages);
  const findings = useWorkspaceStore((s) => s.findings);
  const ctx = useWorkspaceStore((s) => s.context);
  const composerMode = useWorkspaceStore((s) => s.composerMode);
  const setComposerMode = useWorkspaceStore((s) => s.setComposerMode);
  const draft = useWorkspaceStore((s) => s.draft);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const isRecording = useWorkspaceStore((s) => s.isRecording);
  const setRecording = useWorkspaceStore((s) => s.setRecording);
  const isProcessing = useWorkspaceStore((s) => s.isProcessingAnswer);
  const setProcessing = useWorkspaceStore((s) => s.setProcessingAnswer);
  const lastLatencyMs = useWorkspaceStore((s) => s.lastLatencyMs);
  const setLastLatencyMs = useWorkspaceStore((s) => s.setLastLatencyMs);
  const appendMessage = useWorkspaceStore((s) => s.appendMessage);
  const setRightTab = useWorkspaceStore((s) => s.setRightTab);

  // Hydrate the store from the mocked workspace bundle once.
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    if (!data || bootstrapped) return;
    setContext(data.context);
    setMessages(data.messages);
    setFindings(data.candidateFindings);
    setBootstrapped(true);
  }, [data, bootstrapped, setContext, setMessages, setFindings]);

  // Per-card refs for Cmd/Ctrl+1..9 keyboard jumps.
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      // Cmd/Ctrl+1..9 -> jump to finding card index.
      if (mod && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const el = cardRefs.current[idx];
        if (el) {
          e.preventDefault();
          setRightTab('findings');
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Cmd/Ctrl+L -> jump to Live Interview composer mode.
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setComposerMode('live_interview');
        const ta = document.getElementById('composer-textarea') as HTMLTextAreaElement | null;
        ta?.focus();
        return;
      }

      // Cmd/Ctrl+E -> cycle composer mode.
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const i = COMPOSER_ORDER.indexOf(composerMode);
        const next = COMPOSER_ORDER[(i + 1) % COMPOSER_ORDER.length]!;
        setComposerMode(next);
        return;
      }

      // Suggestion keyboard model: Tab moves between, Enter accepts focused
      // suggestion's primary action, Esc skips.
      if (!mod && (e.key === 'Enter' || e.key === 'Escape') && !inEditable) {
        const focusedArticle = document.activeElement?.closest('[data-suggestion-index]');
        if (!focusedArticle) return;
        if (e.key === 'Enter') {
          const primary = focusedArticle.querySelector<HTMLButtonElement>('[data-suggestion-primary]');
          primary?.click();
          e.preventDefault();
        } else {
          const skip = focusedArticle.querySelectorAll('button')[2] as HTMLButtonElement | undefined;
          // 0 = accept, 1 = edit, 2 = skip (per SystemSuggestion order).
          skip?.click();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [composerMode, setComposerMode, setRightTab]);

  const labels = useMemo(() => modeLabels(ctx?.mode ?? 'audit'), [ctx?.mode]);

  if (isLoading || !ctx) {
    return <WorkspaceSkeleton />;
  }

  const handleAcceptSuggestion = (id: string) => {
    const sug = messages.find(
      (m): m is Extract<ConversationMessage, { kind: 'system_suggestion' }> =>
        m.id === id && m.kind === 'system_suggestion',
    );
    if (!sug) return;
    appendMessage({
      id: `m-acc-${Date.now()}`,
      kind: 'auditor_message',
      ts: nowHHMM(),
      auditorName: 'M. Castellanos',
      intervieweeName: 'Dr. K. Ito',
      intervieweeRole: 'Data Lead',
      body: sug.body,
    });
  };

  const handleEditSuggestion = (id: string) => {
    const sug = messages.find(
      (m): m is Extract<ConversationMessage, { kind: 'system_suggestion' }> =>
        m.id === id && m.kind === 'system_suggestion',
    );
    if (!sug) return;
    setComposerMode('question');
    setDraft(sug.body);
    const ta = document.getElementById('composer-textarea') as HTMLTextAreaElement | null;
    ta?.focus();
  };

  const handleSkipSuggestion = (_id: string) => {
    // In production, posts a skip + reason (logged for engine training).
  };

  const handleInjectFollowup = (_id: string) => {
    // Inline alert action — the engine queues a follow-up question. Mocked
    // here as a no-op since the conversation already includes the next
    // suggestion message.
  };

  const handleSend = () => {
    const t0 = performance.now();
    const text = draft.trim();
    if (!text && composerMode !== 'live_interview') return;

    if (composerMode === 'note') {
      // Notes are auditor-only and not posted to the chat as auditee answers.
      // For this mock, append as a private auditor message so it shows up.
      appendMessage({
        id: `m-note-${Date.now()}`,
        kind: 'auditor_message',
        ts: nowHHMM(),
        auditorName: 'M. Castellanos',
        intervieweeName: 'Self note',
        body: `[note] ${text}`,
      });
      setDraft('');
      return;
    }

    if (composerMode === 'question') {
      appendMessage({
        id: `m-q-${Date.now()}`,
        kind: 'auditor_message',
        ts: nowHHMM(),
        auditorName: 'M. Castellanos',
        intervieweeName: 'Dr. K. Ito',
        intervieweeRole: 'Data Lead',
        body: text,
      });
      setDraft('');
      return;
    }

    // Live interview: simulate auditee answer + processing latency.
    const answerText =
      text.length > 0
        ? text
        : 'We capture every cohort export with a hash and the DICOM source.';

    const newAnswer: AuditeeAnswerMessage = {
      id: `m-ans-${Date.now()}`,
      kind: 'auditee_answer',
      ts: nowHHMM(),
      speakerName: 'Dr. K. Ito',
      source: 'transcribed_local',
      body: answerText,
    };
    appendMessage(newAnswer);
    setDraft('');
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setLastLatencyMs(Math.round(performance.now() - t0));
    }, 2000);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[3rem_2.25rem_1fr] bg-background">
      <WorkspaceHeader ctx={ctx} modeLabel={labels.modePill} />
      <MiniAuditDashboard ctx={ctx} />

      <div className="grid min-h-0 grid-cols-[62%_38%]">
        <section
          className="flex min-h-0 flex-col border-r border-border bg-background"
          aria-label="Audit conversation"
        >
          <ChatStream
            messages={messages}
            onAcceptSuggestion={handleAcceptSuggestion}
            onEditSuggestion={handleEditSuggestion}
            onSkipSuggestion={handleSkipSuggestion}
            onInjectFollowup={handleInjectFollowup}
          />
          <Composer
            mode={composerMode}
            onModeChange={setComposerMode}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            isRecording={isRecording}
            onToggleRecording={() => setRecording(!isRecording)}
            onAttach={() => undefined}
            isProcessing={isProcessing}
            latencyMs={lastLatencyMs}
          />
        </section>

        <RightPane
          mode={ctx.mode}
          findings={findings}
          claims={data?.claims ?? []}
          coverageArea={data?.coverageArea ?? { id: '', title: '', cells: [] }}
          cardRefs={cardRefs}
        />
      </div>
    </div>
  );
}

function nowHHMM(): string {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function WorkspaceSkeleton() {
  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[3rem_2.25rem_1fr] bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      <div className="flex items-center gap-4 border-b border-border px-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      <div className="grid min-h-0 grid-cols-[62%_38%]">
        <div className="flex flex-col gap-3 border-r border-border p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="ml-auto h-16 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
