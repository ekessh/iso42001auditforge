// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import type { PresenceState } from '@auditforge/working-papers';

export interface PresenceListProps {
  peers: PresenceState[];
  /** WHY: The screen-reader announcement throttle prevents spam when 5+
   *  peers join in a 2 s window. Default ~2 s. */
  announceDebounceMs?: number;
}

export function PresenceList({ peers, announceDebounceMs = 2_000 }: PresenceListProps) {
  const [announcement, setAnnouncement] = React.useState('');
  const lastAnnouncedRef = React.useRef<number>(0);

  React.useEffect(() => {
    const now = Date.now();
    if (now - lastAnnouncedRef.current < announceDebounceMs) return;
    lastAnnouncedRef.current = now;
    if (peers.length === 0) {
      setAnnouncement('No other auditors editing.');
    } else {
      const names = peers.map((p) => p.user.displayName).join(', ');
      setAnnouncement(
        peers.length === 1
          ? `${names} is editing this working paper.`
          : `${peers.length} auditors editing: ${names}.`,
      );
    }
  }, [peers, announceDebounceMs]);

  return (
    <div className="flex items-center gap-2" data-testid="presence-list">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <ul className="flex -space-x-1.5" aria-label="Connected auditors">
        {peers.length === 0 ? (
          <li className="text-2xs text-muted-foreground">No collaborators</li>
        ) : (
          peers.map((p) => (
            <li
              key={p.user.auditorId}
              className="size-6 rounded-full border-2 border-background text-2xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: p.user.color }}
              title={p.user.displayName}
            >
              <span aria-hidden className="flex size-full items-center justify-center">
                {initials(p.user.displayName)}
              </span>
              <span className="sr-only">{p.user.displayName}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}
