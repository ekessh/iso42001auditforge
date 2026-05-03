// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * RightPane — tabbed surface alongside the chat stream per v3 §15.11.
 *
 * Tabs: Candidate Findings (default) | Coverage | Claims | Parked
 * Mode-aware labels: Audit Mode shows "Candidate Findings" / "Promote to
 * Finding"; Readiness Mode shows "Improvement Items" / "Add to Action Plan".
 */

import { AnimatePresence } from 'framer-motion';
import * as React from 'react';

import type {
  CandidateFinding,
  ClaimEntry,
  CoverageArea,
  EngagementMode,
} from '@/lib/mocks/workspace-mock';
import {
  modeLabels,
  type RightPaneTab,
  useWorkspaceStore,
} from '@/lib/store/workspace-store';

import { CandidateFindingCard } from './CandidateFindingCard';
import { ClaimsTab } from './ClaimsTab';
import { CoverageHeatmap } from './CoverageHeatmap';
import { ParkedTab } from './ParkedTab';

export interface RightPaneProps {
  mode: EngagementMode;
  findings: CandidateFinding[];
  claims: ClaimEntry[];
  coverageArea: CoverageArea;
  cardRefs: React.MutableRefObject<Array<HTMLElement | null>>;
}

export function RightPane({ mode, findings, claims, coverageArea, cardRefs }: RightPaneProps) {
  const tab = useWorkspaceStore((s) => s.rightTab);
  const setTab = useWorkspaceStore((s) => s.setRightTab);
  const selected = useWorkspaceStore((s) => s.selectedFindingId);
  const select = useWorkspaceStore((s) => s.selectFinding);
  const updateFinding = useWorkspaceStore((s) => s.updateFinding);
  const parkFinding = useWorkspaceStore((s) => s.parkFinding);
  const unparkFinding = useWorkspaceStore((s) => s.unparkFinding);
  const deleteFinding = useWorkspaceStore((s) => s.deleteFinding);

  const labels = modeLabels(mode);

  const open = findings.filter((f) => !f.parked);
  const parked = findings.filter((f) => f.parked);

  const TABS: Array<{ id: RightPaneTab; label: string; count?: number }> = [
    { id: 'findings', label: labels.rightPaneTitle, count: open.length },
    { id: 'coverage', label: 'Coverage' },
    { id: 'claims', label: 'Claims', count: claims.length },
    { id: 'parked', label: 'Parked', count: parked.length },
  ];

  return (
    <aside
      className="flex min-h-0 flex-col bg-card"
      aria-label={`${labels.rightPaneTitle} and coverage`}
    >
      <div role="tablist" aria-label="Right pane sections" className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`pane-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium ${
              tab === t.id
                ? 'border-b-2 border-success text-foreground'
                : '-mb-px border-b-2 border-transparent text-muted-foreground hover:text-foreground'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {t.label}
            {t.count != null ? (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  tab === t.id
                    ? 'bg-success/20 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'findings' && (
          <section
            id="pane-findings"
            role="tabpanel"
            aria-labelledby="tab-findings"
            className="space-y-2"
          >
            <AnimatePresence initial={false}>
              {open.map((f, i) => (
                <CandidateFindingCard
                  key={f.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  finding={f}
                  index={i}
                  isSelected={selected === f.id}
                  onSelect={() => select(f.id)}
                  promoteLabel={labels.promoteShort}
                  parkLabel={labels.parkLabel}
                  onPromote={() => {
                    /* In production: opens Add drawer pre-filled with v2 finding form. */
                  }}
                  onPark={() => parkFinding(f.id)}
                  onUnpark={() => unparkFinding(f.id)}
                  onDelete={(reason) => {
                    deleteFinding(f.id);
                    // Reason is logged via the engine's negative training signal pipeline.
                    void reason;
                  }}
                  onEditSave={(stmt) => updateFinding(f.id, { statement: stmt })}
                />
              ))}
            </AnimatePresence>
            {open.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-2xs text-muted-foreground">
                No open candidate findings yet. They appear automatically as
                claims accumulate.
              </p>
            ) : null}
          </section>
        )}

        {tab === 'coverage' && (
          <section
            id="pane-coverage"
            role="tabpanel"
            aria-labelledby="tab-coverage"
          >
            <CoverageHeatmap area={coverageArea} />
          </section>
        )}

        {tab === 'claims' && (
          <section
            id="pane-claims"
            role="tabpanel"
            aria-labelledby="tab-claims"
          >
            <ClaimsTab claims={claims} />
          </section>
        )}

        {tab === 'parked' && (
          <section
            id="pane-parked"
            role="tabpanel"
            aria-labelledby="tab-parked"
          >
            <ParkedTab
              parked={parked}
              promoteLabel={labels.promoteShort}
              parkLabel={labels.parkLabel}
              onPromote={() => undefined}
              onUnpark={(id) => unparkFinding(id)}
              onDelete={(id, reason) => {
                deleteFinding(id);
                void reason;
              }}
              onEditSave={(id, stmt) => updateFinding(id, { statement: stmt })}
            />
          </section>
        )}
      </div>
    </aside>
  );
}
