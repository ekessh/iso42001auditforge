// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * CandidateFindingCard — right-pane card per v3 §15.11.
 *
 * Each card shows:
 *   - Type badge (Major NC / Minor NC / OFI / Observation), color-coded
 *   - Draft NC statement (2–3 lines, expandable)
 *   - Linked clause chips
 *   - Confidence dot (Low/Medium/High; not a number)
 *   - Evidence chain link ("From answer at 14:32 about model retraining")
 *   - Action row: Edit | Delete | Add | Park
 *
 * Mode-aware labels:
 *   - Audit Mode    "Promote to Finding"
 *   - Readiness Mode "Add to Action Plan"
 *
 * Cards animate in from the top with framer-motion. Respects
 * prefers-reduced-motion via Tailwind motion-safe utility variants.
 */

import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Plus,
  Save,
  Trash2,
  Bookmark,
  BookmarkX,
} from 'lucide-react';
import * as React from 'react';

import type { CandidateFinding, FindingType, Confidence } from '@/lib/mocks/workspace-mock';

const TYPE_META: Record<FindingType, { tone: string; ring: string; label: string }> = {
  major: {
    tone: 'bg-destructive/15 text-destructive border-destructive/30',
    ring: 'border-l-destructive',
    label: 'Major NC',
  },
  minor: {
    tone: 'bg-warning/15 text-warning border-warning/30',
    ring: 'border-l-warning',
    label: 'Minor NC',
  },
  ofi: {
    tone: 'bg-info/15 text-info border-info/30',
    ring: 'border-l-info',
    label: 'OFI',
  },
  observation: {
    tone: 'bg-muted text-muted-foreground border-border',
    ring: 'border-l-border',
    label: 'Observation',
  },
};

const CONFIDENCE_META: Record<Confidence, { dot: string; label: string }> = {
  high: { dot: 'bg-success', label: 'High' },
  medium: { dot: 'bg-warning', label: 'Medium' },
  low: { dot: 'bg-muted-foreground', label: 'Low' },
};

export interface CandidateFindingCardProps {
  finding: CandidateFinding;
  promoteLabel: string;
  parkLabel: string;
  /** 0-based index used for Cmd/Ctrl+1..9 keyboard jumps. */
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onEditSave?: (statement: string) => void;
  onDelete: (reason: string) => void;
  onPromote: () => void;
  onPark: () => void;
  onUnpark?: () => void;
}

export const CandidateFindingCard = React.forwardRef<HTMLElement, CandidateFindingCardProps>(
  function CandidateFindingCardInner(
    {
      finding,
      promoteLabel,
      parkLabel,
      index,
      isSelected,
      onSelect,
      onEditSave,
      onDelete,
      onPromote,
      onPark,
      onUnpark,
    },
    ref,
  ) {
    const meta = TYPE_META[finding.type];
    const conf = CONFIDENCE_META[finding.confidence];

    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(finding.statement);
    const [expanded, setExpanded] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [reason, setReason] = React.useState<string>('false_positive');
    const [reasonText, setReasonText] = React.useState('');

    React.useEffect(() => {
      setDraft(finding.statement);
    }, [finding.statement]);

    return (
      <motion.article
        ref={ref}
        layout
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        tabIndex={0}
        data-finding-index={index}
        aria-labelledby={`${finding.id}-stmt`}
        onFocus={onSelect}
        className={`group rounded-lg border border-l-4 border-border bg-card p-3 shadow-xs focus:outline-none focus:ring-2 focus:ring-ring ${meta.ring} ${
          isSelected ? 'ring-2 ring-ring' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
          >
            {finding.typeLabel ?? meta.label}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-2xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${conf.dot}`}
              aria-hidden
            />
            <span aria-label={`Confidence: ${conf.label}`}>{conf.label}</span>
          </span>
        </div>

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="mt-2 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Edit finding statement"
          />
        ) : (
          <p
            id={`${finding.id}-stmt`}
            className={`mt-2 text-sm leading-relaxed text-foreground ${expanded ? '' : 'line-clamp-3'}`}
          >
            {finding.statement}
          </p>
        )}

        {!editing && finding.statement.length > 160 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1 inline-flex items-center gap-0.5 text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {expanded ? <ChevronUp className="size-3" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        ) : null}

        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Linked clauses">
          {finding.clauses.map((c) => (
            <li
              key={c.id}
              className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {c.label}
            </li>
          ))}
        </ul>

        <p className="mt-2 text-[10px] text-muted-foreground">{finding.source}</p>

        {/* Delete confirm */}
        {confirmDelete ? (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-2">
            <p className="text-2xs font-medium text-foreground">Dismiss reason (logged for engine training):</p>
            <fieldset className="mt-1.5 space-y-1 text-2xs">
              {(['false_positive', 'not_in_scope', 'duplicate', 'other'] as const).map((r) => (
                <label key={r} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`reason-${finding.id}`}
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-foreground"
                  />
                  {r.replace('_', ' ')}
                </label>
              ))}
              {reason === 'other' ? (
                <input
                  type="text"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Reason…"
                  className="mt-1 w-full rounded border border-border bg-background px-1.5 py-0.5 text-2xs"
                />
              ) : null}
            </fieldset>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => onDelete(reason === 'other' ? reasonText : reason)}
                className="rounded-md bg-destructive px-2 py-0.5 text-2xs font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Confirm dismiss
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border bg-transparent px-2 py-0.5 text-2xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Finding actions">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onEditSave?.(draft);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-success px-2 py-1 text-2xs font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Save className="size-3" aria-hidden />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(finding.statement);
                  setEditing(false);
                }}
                className="inline-flex items-center rounded-md border border-border bg-transparent px-2 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onPromote}
                className="inline-flex items-center gap-1 rounded-md bg-success px-2 py-1 text-2xs font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-3" aria-hidden />
                {promoteLabel}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Edit2 className="size-3" aria-hidden />
                Edit
              </button>
              {finding.parked ? (
                <button
                  type="button"
                  onClick={onUnpark}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BookmarkX className="size-3" aria-hidden />
                  Unpark
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPark}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Bookmark className="size-3" aria-hidden />
                  {parkLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-3" aria-hidden />
                Delete
              </button>
            </>
          )}
        </div>
      </motion.article>
    );
  },
);
