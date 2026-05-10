// SPDX-License-Identifier: BUSL-1.1
import { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

export interface PresenceUser {
  auditorId: string;
  displayName: string;
  color: string;
}

export interface PresenceCursor {
  anchor: number;
  head: number;
}

export interface PresenceState {
  user: PresenceUser;
  cursor?: PresenceCursor;
  section?: string;
  updatedAt: number;
}

const DEFAULT_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#9333ea',
  '#0d9488',
] as const;

/**
 * WHY: Deterministic colour avoids two replicas picking the same hue when an
 * auditor opens the same WP across devices. djb2 is fast + collision-tolerant
 * for the small palette we cycle through.
 */
export function colorForAuditor(auditorId: string): string {
  let hash = 5381;
  for (let i = 0; i < auditorId.length; i += 1) {
    hash = ((hash << 5) + hash + auditorId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DEFAULT_PALETTE.length;
  return DEFAULT_PALETTE[idx]!;
}

export function createAwareness(doc: Y.Doc): Awareness {
  return new Awareness(doc);
}

export function setLocalPresence(
  awareness: Awareness,
  state: Omit<PresenceState, 'updatedAt'>,
): void {
  awareness.setLocalState({
    ...state,
    updatedAt: Date.now(),
  });
}

export function clearLocalPresence(awareness: Awareness): void {
  awareness.setLocalState(null);
}

export function listPeers(awareness: Awareness): PresenceState[] {
  const states: PresenceState[] = [];
  awareness.getStates().forEach((value, clientId) => {
    if (clientId === awareness.clientID) return;
    if (!value || typeof value !== 'object') return;
    const candidate = value as Partial<PresenceState>;
    if (
      candidate.user &&
      typeof candidate.user.auditorId === 'string' &&
      typeof candidate.user.displayName === 'string'
    ) {
      states.push(candidate as PresenceState);
    }
  });
  return states;
}
