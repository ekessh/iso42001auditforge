// SPDX-License-Identifier: BUSL-1.1
'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { ConsentBanner } from '@/components/interview/ConsentBanner';
import { CoverageDeltaSidebar } from '@/components/interview/CoverageDeltaSidebar';
import { EvidenceUploader } from '@/components/interview/EvidenceUploader';
import { SpeakerLegend } from '@/components/interview/SpeakerLegend';
import { TranscriptPane } from '@/components/interview/TranscriptPane';
import { useLiveInterview } from '@/lib/hooks/use-live-interview';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function LiveInterviewPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const [consented, setConsented] = useState<boolean | null>(null);
  const [aborted, setAborted] = useState(false);
  const [offline, setOffline] = useState(false);

  const {
    transcript,
    coverageDelta,
    currentSpeaker,
    isRecording,
    isConnected,
    startRecording,
    stopRecording,
    pushChunk,
  } = useLiveInterview({ sessionId });

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const update = (): void => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!consented) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'm' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const last = transcript[transcript.length - 1];
        if (last) onMarkCandidate(last.id);
      }
      if (e.key.toLowerCase() === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isRecording) stopRecording();
        else void startRecording();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [consented, isRecording, startRecording, stopRecording, transcript]);

  const onMarkCandidate = useCallback((segmentId: string) => {
    void segmentId;
  }, []);

  if (consented === null) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <ConsentBanner
          onAccept={() => setConsented(true)}
          onReject={() => setAborted(true)}
        />
      </div>
    );
  }

  if (aborted) {
    return (
      <div role="alert" className="mx-auto max-w-2xl p-6 text-sm">
        Session cancelled. No recording or transcription occurred.
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-rows-[auto_1fr] gap-3 bg-background p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Live interview</h1>
        <span className="text-xs text-muted-foreground">
          session {sessionId.slice(0, 8)}
        </span>
        <span
          aria-live="polite"
          className={`rounded-full px-2 py-0.5 text-xs ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-700'
              : 'bg-red-500/10 text-red-700'
          }`}
        >
          {isConnected ? 'connected' : 'disconnected'}
        </span>
        {offline ? (
          <span
            role="status"
            className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700"
          >
            offline — buffering locally
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <SpeakerLegend
            speakers={[
              { id: 'SPK-A', label: 'Auditor' },
              { id: 'SPK-B', label: 'Auditee' },
            ]}
            current={currentSpeaker}
          />
          <button
            type="button"
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`rounded px-3 py-1 text-sm font-medium text-white ${
              isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
            aria-pressed={isRecording}
          >
            {isRecording ? 'Stop (⌘P)' : 'Start (⌘P)'}
          </button>
          <button
            type="button"
            onClick={() => pushChunk('We review the risk register quarterly.')}
            className="rounded border border-border bg-background px-3 py-1 text-sm hover:bg-muted/50"
            aria-label="Send a stub transcript chunk for testing"
          >
            Send stub chunk
          </button>
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-[1fr_320px] gap-3">
        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
          <TranscriptPane segments={transcript} onMarkCandidate={onMarkCandidate} />
          <EvidenceUploader />
        </div>
        <CoverageDeltaSidebar items={coverageDelta} />
      </main>
    </div>
  );
}
