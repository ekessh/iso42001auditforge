// SPDX-License-Identifier: BUSL-1.1
import * as Y from 'yjs';
import type { Verdict, Confidence } from './domain.js';

/**
 * Canonical Y.Doc shape for a working paper.
 *
 * Slots:
 *  - meta:        Y.Map  (verdict, confidence, lastEditedAt, authorId, revision)
 *  - body:        Y.XmlFragment (rich text — the editor binds to this)
 *  - checklists:  Y.Array<Y.Map>   each: { id, text, state ('yes'|'no'|'na'), notedAt? }
 *  - observations:Y.Array<Y.Map>   each: { id, text, severity, authorId, createdAt }
 *  - evidence:    Y.Array<Y.Map>   each: { id, kind, refId, note? }
 */
export const WP_DOC_SLOTS = Object.freeze({
  meta: 'meta',
  body: 'body',
  checklists: 'checklists',
  observations: 'observations',
  evidence: 'evidence',
} as const);

export interface WorkingPaperDoc {
  doc: Y.Doc;
  meta: Y.Map<unknown>;
  body: Y.XmlFragment;
  checklists: Y.Array<Y.Map<unknown>>;
  observations: Y.Array<Y.Map<unknown>>;
  evidence: Y.Array<Y.Map<unknown>>;
}

/**
 * Construct a fresh working-paper Y.Doc. Pass a `seed` to deterministically
 * reproduce a doc for testing — set `clientID` to a known value.
 */
export function createWorkingPaperDoc(opts?: {
  clientID?: number;
}): WorkingPaperDoc {
  const doc = new Y.Doc();
  if (opts?.clientID !== undefined) {
    doc.clientID = opts.clientID;
  }
  const meta = doc.getMap(WP_DOC_SLOTS.meta);
  const body = doc.getXmlFragment(WP_DOC_SLOTS.body);
  const checklists = doc.getArray<Y.Map<unknown>>(WP_DOC_SLOTS.checklists);
  const observations = doc.getArray<Y.Map<unknown>>(WP_DOC_SLOTS.observations);
  const evidence = doc.getArray<Y.Map<unknown>>(WP_DOC_SLOTS.evidence);
  return { doc, meta, body, checklists, observations, evidence };
}

/**
 * Encode the entire current state as an update vector — base64 string for
 * transport-agnostic storage. This is what `WorkingPaper.content` carries.
 */
export function encodeSnapshot(doc: Y.Doc): string {
  const update = Y.encodeStateAsUpdateV2(doc);
  return bytesToBase64(update);
}

/** Apply a previously-encoded snapshot to a doc. */
export function applySnapshot(doc: Y.Doc, snapshot: string): void {
  const update = base64ToBytes(snapshot);
  Y.applyUpdateV2(doc, update);
}

/** Pure bytes form for callers that don't want base64. */
export function encodeSnapshotBytes(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc);
}
export function applySnapshotBytes(doc: Y.Doc, bytes: Uint8Array): void {
  Y.applyUpdateV2(doc, bytes);
}

/** State vector for delta exchange. */
export function encodeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

/** Compute a delta update from `peerStateVector` to current `doc` state. */
export function diffSinceStateVector(
  doc: Y.Doc,
  peerStateVector: Uint8Array,
): Uint8Array {
  return Y.encodeStateAsUpdateV2(doc, peerStateVector);
}

/** Helper: read meta.verdict (defaults to 'conformant'). */
export function readVerdict(meta: Y.Map<unknown>): Verdict {
  const v = meta.get('verdict');
  return (v as Verdict) ?? 'conformant';
}

/** Helper: read meta.confidence (defaults to 0). */
export function readConfidence(meta: Y.Map<unknown>): Confidence {
  const c = meta.get('confidence');
  return typeof c === 'number' ? (c as Confidence) : (0 as Confidence);
}

/** Set meta.verdict atomically. Caller is responsible for state-machine validation. */
export function writeVerdict(meta: Y.Map<unknown>, v: Verdict): void {
  meta.set('verdict', v);
}

/** Set meta.confidence with bounds enforcement. */
export function writeConfidence(meta: Y.Map<unknown>, c: number): void {
  if (!Number.isInteger(c) || c < 0 || c > 100) {
    throw new RangeError(`confidence out of range: ${c}`);
  }
  meta.set('confidence', c);
}

/* -------------------------------------------------------------------------- */
/* Provider interface                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Transport-agnostic provider interface. Implementations live OUTSIDE this
 * package (e.g. a NestJS module that wraps `y-websocket` or Hocuspocus). This
 * package never imports a transport.
 */
export interface CrdtProvider {
  /**
   * Bind a doc to a transport room. Must be idempotent — calling twice with
   * the same `roomId` MUST return the same logical session.
   */
  connect(roomId: string, doc: Y.Doc): CrdtSession;
  /**
   * Disconnect everything. Returns once all in-flight broadcasts have flushed
   * to peers (or after `opts.timeoutMs`, whichever comes first).
   */
  shutdown(opts?: { timeoutMs?: number }): Promise<void>;
}

export interface CrdtSession {
  readonly roomId: string;
  readonly doc: Y.Doc;
  /** Publish a local update to peers. */
  broadcastUpdate(update: Uint8Array, origin?: unknown): void;
  /** Subscribe to remote updates. Returns an unsubscribe handle. */
  onRemoteUpdate(
    listener: (update: Uint8Array, origin: unknown) => void,
  ): () => void;
  /** Disconnect this room only. */
  disconnect(): void;
}

/* -------------------------------------------------------------------------- */
/* base64                                                                      */
/* -------------------------------------------------------------------------- */

function bytesToBase64(bytes: Uint8Array): string {
  // Node 18+: Buffer; in browser polyfills use btoa+chunked encoding.
  // We prefer Buffer when available because tests run under Node.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
