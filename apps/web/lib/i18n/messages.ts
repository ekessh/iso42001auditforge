// SPDX-License-Identifier: BUSL-1.1
/**
 * Typed message catalogue (English baseline).
 *
 * Source of truth for every UI string that varies by engagement mode
 * (ADR-0013 audit vs readiness) plus the workspace navigation, action
 * labels, and disclaimers flagged by code-quality review I18N-01..I18N-06.
 *
 * Keys follow `dot.namespaced.path` convention. The matching JSON
 * locale file (`./locales/en.json`) carries the same keys; extending the
 * UI to a second locale is a drop-in JSON file plus a registration in
 * `./index.ts`.
 *
 * Mode-aware strings (per ADR-0013 §15.13):
 *   - workspace.rightPane.title.{audit|readiness}
 *   - workspace.actions.promote.{audit|readiness}
 *   - workspace.modeBadge.{audit|readiness}
 *   - workspace.disclaimer.readiness    (audit mode requires no disclaimer)
 */
export const messages = {
  // -- Mode-aware right pane (ADR-0013 §15.13) -----------------------------
  'workspace.rightPane.title.audit': 'Candidate Findings',
  'workspace.rightPane.title.readiness': 'Improvement Items',

  // -- Mode-aware promote action -------------------------------------------
  'workspace.actions.promote.audit': 'Promote to Finding',
  'workspace.actions.promote.readiness': 'Add to Action Plan',
  'workspace.actions.promote.short': 'Add',

  // -- Mode-aware park action (mode-neutral text but kept here for parity) -
  'workspace.actions.park': 'Park',

  // -- Mode badge / pill ---------------------------------------------------
  'workspace.modeBadge.audit': 'Audit Mode',
  'workspace.modeBadge.readiness': 'Readiness Mode',

  // -- Readiness-only disclaimer (must be visible in readiness mode) -------
  'workspace.disclaimer.readiness':
    'This is a self-assessment using ISO 42001 as the reference framework. It is not a certification or formal audit. Only an accredited certification body can issue ISO 42001 certification.',

  // -- Right pane tabs (I18N-01) -------------------------------------------
  'workspace.rightPane.tabs.findings': 'Findings',
  'workspace.rightPane.tabs.coverage': 'Coverage',
  'workspace.rightPane.tabs.claims': 'Claims',
  'workspace.rightPane.tabs.parked': 'Parked',

  // -- Candidate Finding type labels (I18N-02 — TYPE_META in
  //    apps/web/components/workspace/CandidateFindingCard.tsx) -------------
  'workspace.findingType.major': 'Major Nonconformity',
  'workspace.findingType.minor': 'Minor Nonconformity',
  'workspace.findingType.observation': 'Observation',
  'workspace.findingType.opportunity': 'Opportunity',
  'workspace.findingType.improvement': 'Improvement Item',

  // -- Auditor dashboard (I18N-03) -----------------------------------------
  'dashboard.kpi.activeEngagements': 'Active engagements',
  'dashboard.kpi.openMajorNcs': 'Open major NCs',
  'dashboard.kpi.openMinorNcs': 'Open minor NCs',
  'dashboard.kpi.probesExecuted': 'Probes executed',
  'dashboard.action.startEngagement': 'Start new engagement',
  'dashboard.action.runProbe': 'Run probe',
  'dashboard.action.raiseNc': 'Raise NC',

  // -- Auditor pages (I18N-04) ---------------------------------------------
  'page.findings.title': 'Findings',
  'page.library.title': 'Library',
  'page.probes.title': 'Probes',

  // -- Auditor shell nav (I18N-05) -----------------------------------------
  'nav.dashboard': 'Dashboard',
  'nav.clients': 'Clients',
  'nav.engagements': 'Engagements',
  'nav.findings': 'Findings',
  'nav.probes': 'Probes',
  'nav.library': 'Library',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
} as const;

/** Compile-time union of every legal message key. */
export type MessageKey = keyof typeof messages;

/**
 * Type alias used by mode-aware lookups so callers cannot drift the audit
 * vs readiness suffix from the engagement domain enum.
 */
export type ModeKey = 'audit' | 'readiness';
