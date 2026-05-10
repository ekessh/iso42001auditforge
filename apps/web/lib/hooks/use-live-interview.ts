// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface LiveTranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string;
  confidence: number;
  attached?: { clauseId: string; confidence: number }[];
}

export interface CoverageDeltaItem {
  clauseId: string;
  confidence: number;
  segmentId: string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const IDB_DB = 'auditforge-live-interview';
const IDB_STORE = 'transcripts';

interface UseLiveInterviewOpts {
  sessionId: string;
  endpoint?: string;
}

interface UseLiveInterviewReturn {
  transcript: LiveTranscriptSegment[];
  currentSpeaker: string | null;
  coverageDelta: CoverageDeltaItem[];
  isRecording: boolean;
  isConnected: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pushChunk: (chunk: Blob | string) => void;
}

/**
 * WHY: Centralises the WebSocket lifecycle so the page component stays
 * declarative. Last 5 minutes of transcript is mirrored to IndexedDB so a
 * mid-interview reload doesn't drop context.
 */
export function useLiveInterview({
  sessionId,
  endpoint,
}: UseLiveInterviewOpts): UseLiveInterviewReturn {
  const [transcript, setTranscript] = useState<LiveTranscriptSegment[]>([]);
  const [coverageDelta, setCoverageDelta] = useState<CoverageDeltaItem[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [isRecording, setRecording] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const url = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (endpoint) return endpoint;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      process.env['NEXT_PUBLIC_API_ORIGIN']?.replace(/^https?:\/\//, '') ??
      window.location.host;
    return `${proto}//${host}/sync/interview/${sessionId}`;
  }, [endpoint, sessionId]);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => active && setConnected(true);
    ws.onclose = () => active && setConnected(false);
    ws.onerror = () => active && setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '{}');
        if (msg?.kind === 'segment' && msg.segment) {
          const seg: LiveTranscriptSegment = {
            id: msg.segment.id,
            startMs: msg.segment.startMs,
            endMs: msg.segment.endMs,
            text: msg.segment.text,
            speakerId: msg.segment.speakerId,
            confidence: msg.segment.confidence,
            attached: msg.attached ?? [],
          };
          setTranscript((prev) => trimByWindow([...prev, seg]));
          setCurrentSpeaker(seg.speakerId);
          if (Array.isArray(msg.attached)) {
            setCoverageDelta((prev) => mergeDeltas(prev, msg.attached, seg.id));
          }
          void persistChunk(sessionId, seg);
        }
      } catch {
        /* swallow */
      }
    };
    return () => {
      active = false;
      try {
        ws.close();
      } catch {
        /* swallow */
      }
    };
  }, [sessionId, url]);

  useEffect(() => {
    void hydrateRecent(sessionId).then((rows) => {
      if (rows.length > 0) setTranscript((prev) => trimByWindow([...rows, ...prev]));
    });
  }, [sessionId]);

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('mediaDevices unavailable');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    rec.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ kind: 'audio-chunk', text: '[chunk]' }));
    };
    rec.start(2_000);
    recRef.current = rec;
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recRef.current?.stop();
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    setRecording(false);
  }, []);

  const pushChunk = useCallback((chunk: Blob | string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (typeof chunk === 'string') {
      ws.send(JSON.stringify({ kind: 'audio-chunk', text: chunk }));
    } else {
      ws.send(JSON.stringify({ kind: 'audio-chunk', text: '[binary]' }));
    }
  }, []);

  return {
    transcript,
    currentSpeaker,
    coverageDelta,
    isRecording,
    isConnected,
    startRecording,
    stopRecording,
    pushChunk,
  };
}

function trimByWindow(segs: LiveTranscriptSegment[]): LiveTranscriptSegment[] {
  if (segs.length === 0) return segs;
  const last = segs[segs.length - 1];
  if (!last) return segs;
  const cutoff = last.endMs - FIVE_MINUTES_MS;
  return segs.filter((s) => s.endMs >= cutoff);
}

function mergeDeltas(
  prev: CoverageDeltaItem[],
  attached: { clauseId: string; confidence: number }[],
  segmentId: string,
): CoverageDeltaItem[] {
  const next = [...prev];
  for (const a of attached) {
    if (!next.find((c) => c.clauseId === a.clauseId)) {
      next.push({ clauseId: a.clauseId, confidence: a.confidence, segmentId });
    }
  }
  return next;
}

async function persistChunk(sessionId: string, seg: LiveTranscriptSegment): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ sessionId, ...seg });
    await txDone(tx);
    db.close();
  } catch {
    /* swallow */
  }
}

async function hydrateRecent(sessionId: string): Promise<LiveTranscriptSegment[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDb();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const all = await reqToPromise<IDBValidKey[]>(store.getAllKeys());
    const out: LiveTranscriptSegment[] = [];
    for (const k of all) {
      const row = await reqToPromise<{ sessionId: string } & LiveTranscriptSegment>(
        store.get(k as IDBValidKey),
      );
      if (row?.sessionId === sessionId) out.push(row);
    }
    await txDone(tx);
    db.close();
    out.sort((a, b) => a.startMs - b.startMs);
    return trimByWindow(out);
  } catch {
    return [];
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function reqToPromise<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
