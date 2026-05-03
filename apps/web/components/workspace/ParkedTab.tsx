// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ParkedTab — list of candidate findings flagged for later review.
 *
 * Per v3 §15.11 the Parked tab holds candidate findings the auditor wants
 * to revisit before audit close. From here they can unpark (returns to the
 * Candidate Findings stream), promote, or delete.
 */

import { Bookmark } from 'lucide-react';
import * as React from 'react';

import type { CandidateFinding } from '@/lib/mocks/workspace-mock';

import { CandidateFindingCard } from './CandidateFindingCard';

export interface ParkedTabProps {
  parked: CandidateFinding[];
  promoteLabel: string;
  parkLabel: string;
  onPromote: (id: string) => void;
  onUnpark: (id: string) => void;
  onDelete: (id: string, reason: string) => void;
  onEditSave: (id: string, statement: string) => void;
}

export function ParkedTab({
  parked,
  promoteLabel,
  parkLabel,
  onPromote,
  onUnpark,
  onDelete,
  onEditSave,
}: ParkedTabProps) {
  if (parked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
        <Bookmark className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-2xs text-muted-foreground">
          No parked items. Use Park on a candidate finding to revisit it
          before audit close.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2" aria-label="Parked candidate findings">
      {parked.map((f, i) => (
        <CandidateFindingCard
          key={f.id}
          finding={f}
          index={i}
          promoteLabel={promoteLabel}
          parkLabel={parkLabel}
          onPromote={() => onPromote(f.id)}
          onPark={() => undefined}
          onUnpark={() => onUnpark(f.id)}
          onDelete={(reason) => onDelete(f.id, reason)}
          onEditSave={(stmt) => onEditSave(f.id, stmt)}
        />
      ))}
    </div>
  );
}
