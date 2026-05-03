// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Composer — bottom-of-pane input row for the Conversational Audit Workspace.
 *
 * Per v3 §15.11: three modes (Question / Live Interview / Note), voice input
 * button (whisper.cpp local in production), evidence attach button, send.
 *
 * Mode semantics:
 *  - Question — auditor types a question directly; bypasses the system
 *    suggestion stream.
 *  - Live interview — voice-first; transcription routed through whisper.cpp
 *    locally (mocked here). Activates microphone on entry.
 *  - Note — auditor's private working note that is *not* sent to the
 *    auditee, but still indexed by the engine.
 *
 * Latency: composer locks for ~2s after answer submit while the attribution
 * pipeline runs ("Processing answer."). Implemented by the parent page.
 *
 * Keyboard:
 *  - Cmd/Ctrl+Enter sends.
 *  - Cmd/Ctrl+E cycles composer mode.
 *  - Cmd/Ctrl+L jumps to Live Interview.
 */

import { Mic, Paperclip, Send, Square, Loader2 } from 'lucide-react';
import * as React from 'react';

import type { ComposerMode } from '@/lib/store/workspace-store';

export interface ComposerProps {
  mode: ComposerMode;
  onModeChange: (m: ComposerMode) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onAttach: () => void;
  isProcessing: boolean;
  /** Optional latency value to surface alongside the spinner. */
  latencyMs?: number | null;
}

const MODES: Array<{ id: ComposerMode; label: string; placeholder: string }> = [
  {
    id: 'question',
    label: 'Question',
    placeholder: 'Type a question for the auditee…',
  },
  {
    id: 'live_interview',
    label: 'Live Interview',
    placeholder:
      'Recording — speak naturally. Speakers: M. Castellanos (Auditor), Dr. K. Ito (Data Lead)…',
  },
  {
    id: 'note',
    label: 'Note',
    placeholder: 'Auditor working note (not sent to auditee)…',
  },
];

export function Composer({
  mode,
  onModeChange,
  draft,
  onDraftChange,
  onSend,
  isRecording,
  onToggleRecording,
  onAttach,
  isProcessing,
  latencyMs,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const placeholder = MODES.find((m) => m.id === mode)?.placeholder ?? '';
  const sendDisabled = isProcessing || (mode !== 'live_interview' && draft.trim().length === 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!sendDisabled) onSend();
    }
  };

  return (
    <form
      className="border-t border-border bg-card/80 px-3 py-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!sendDisabled) onSend();
      }}
      aria-label="Audit composer"
    >
      <div
        className="flex items-end gap-2"
      >
        <div role="tablist" aria-label="Composer mode" className="flex shrink-0 flex-col gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => onModeChange(m.id)}
              className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-2xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                mode === m.id
                  ? 'border-border bg-background text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="composer-textarea">
          {placeholder}
        </label>
        <textarea
          id="composer-textarea"
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={placeholder}
          disabled={isProcessing}
          aria-disabled={isProcessing}
          className="min-h-[44px] max-h-32 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onAttach}
            aria-label="Attach evidence"
            disabled={isProcessing}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Paperclip className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggleRecording}
            aria-pressed={isRecording}
            aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
            disabled={isProcessing}
            className={`inline-flex size-9 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
              isRecording
                ? 'border-destructive bg-destructive text-destructive-foreground motion-safe:animate-pulse'
                : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {isRecording ? (
              <Square className="size-4" aria-hidden />
            ) : (
              <Mic className="size-4" aria-hidden />
            )}
          </button>
          <button
            type="submit"
            disabled={sendDisabled}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-success px-3 text-xs font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-3.5" aria-hidden />
            )}
            {isProcessing ? 'Processing answer…' : 'Send'}
          </button>
        </div>
      </div>

      <div
        className="mt-1.5 flex h-4 items-center justify-between text-2xs text-muted-foreground"
        aria-live="polite"
      >
        <span>
          {mode === 'live_interview'
            ? isRecording
              ? 'Live recording · whisper.cpp local'
              : 'Press microphone to begin live capture.'
            : 'Cmd/Ctrl+Enter to send · Cmd/Ctrl+E switches mode · Cmd/Ctrl+L for Live Interview'}
        </span>
        {latencyMs != null ? (
          <span className="font-mono">{latencyMs} ms · last round-trip</span>
        ) : null}
      </div>
    </form>
  );
}
