// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Zustand store for the v3 Conversational Audit Workspace.
 *
 * Holds *transient* UI state — the canonical source of truth for messages,
 * findings, coverage, and claims is the Conversational Audit Engine via
 * TanStack Query. The store keeps:
 *   - active conversation (subject to optimistic local edits)
 *   - active engagement + scope mode
 *   - right pane tab selection
 *   - selected candidate finding (inline editor target)
 *   - composer state (mode, draft, recording flag)
 *   - latency indicator state
 */

import { create } from 'zustand';

import type {
  CandidateFinding,
  ConversationMessage,
  EngagementMode,
  WorkspaceContext,
} from '@/lib/mocks/workspace-mock';

export type RightPaneTab = 'findings' | 'coverage' | 'claims' | 'parked';
export type ComposerMode = 'question' | 'live_interview' | 'note';

export interface WorkspaceState {
  // -- Engagement / context --------------------------------------------------
  context: WorkspaceContext | null;
  setContext: (ctx: WorkspaceContext) => void;
  setMode: (mode: EngagementMode) => void;

  // -- Conversation ---------------------------------------------------------
  messages: ConversationMessage[];
  setMessages: (m: ConversationMessage[]) => void;
  appendMessage: (m: ConversationMessage) => void;

  // -- Findings -------------------------------------------------------------
  findings: CandidateFinding[];
  setFindings: (f: CandidateFinding[]) => void;
  selectedFindingId: string | null;
  selectFinding: (id: string | null) => void;
  parkFinding: (id: string) => void;
  unparkFinding: (id: string) => void;
  deleteFinding: (id: string) => void;
  updateFinding: (id: string, patch: Partial<CandidateFinding>) => void;

  // -- Right pane -----------------------------------------------------------
  rightTab: RightPaneTab;
  setRightTab: (t: RightPaneTab) => void;

  // -- Composer -------------------------------------------------------------
  composerMode: ComposerMode;
  setComposerMode: (m: ComposerMode) => void;
  draft: string;
  setDraft: (d: string) => void;
  isRecording: boolean;
  setRecording: (r: boolean) => void;

  // -- Latency / processing -------------------------------------------------
  isProcessingAnswer: boolean;
  setProcessingAnswer: (p: boolean) => void;
  /** Last observed end-to-end latency (ms) for the latency badge. */
  lastLatencyMs: number | null;
  setLastLatencyMs: (ms: number | null) => void;

  // -- Why this / Show reasoning panels ------------------------------------
  /** Map of message id -> whether the "Why this?" disclosure is open. */
  whyOpen: Record<string, boolean>;
  toggleWhy: (messageId: string) => void;
  reasoningOpen: Record<string, boolean>;
  toggleReasoning: (messageId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  context: null,
  setContext: (ctx) => set({ context: ctx }),
  setMode: (mode) =>
    set((s) => (s.context ? { context: { ...s.context, mode } } : {})),

  messages: [],
  setMessages: (m) => set({ messages: m }),
  appendMessage: (m) =>
    set((s) => ({ messages: [...s.messages, m] })),

  findings: [],
  setFindings: (f) => set({ findings: f }),
  selectedFindingId: null,
  selectFinding: (id) => set({ selectedFindingId: id }),
  parkFinding: (id) =>
    set((s) => ({
      findings: s.findings.map((f) => (f.id === id ? { ...f, parked: true } : f)),
    })),
  unparkFinding: (id) =>
    set((s) => ({
      findings: s.findings.map((f) => (f.id === id ? { ...f, parked: false } : f)),
    })),
  deleteFinding: (id) =>
    set((s) => ({ findings: s.findings.filter((f) => f.id !== id) })),
  updateFinding: (id, patch) =>
    set((s) => ({
      findings: s.findings.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  rightTab: 'findings',
  setRightTab: (t) => set({ rightTab: t }),

  composerMode: 'live_interview',
  setComposerMode: (m) => set({ composerMode: m }),
  draft: '',
  setDraft: (d) => set({ draft: d }),
  isRecording: false,
  setRecording: (r) => set({ isRecording: r }),

  isProcessingAnswer: false,
  setProcessingAnswer: (p) => set({ isProcessingAnswer: p }),
  lastLatencyMs: 1840,
  setLastLatencyMs: (ms) => set({ lastLatencyMs: ms }),

  whyOpen: {},
  toggleWhy: (id) =>
    set((s) => ({ whyOpen: { ...s.whyOpen, [id]: !s.whyOpen[id] } })),
  reasoningOpen: {},
  toggleReasoning: (id) =>
    set((s) => ({
      reasoningOpen: { ...s.reasoningOpen, [id]: !s.reasoningOpen[id] },
    })),
}));

/**
 * Right-pane labels are mode-aware per v3 §15.13.
 *   Audit Mode      → "Candidate Findings", "Promote to Finding"
 *   Readiness Mode  → "Improvement Items",  "Add to Action Plan"
 */
export interface ModeLabels {
  rightPaneTitle: string;
  promoteAction: string;
  promoteShort: string;
  parkLabel: string;
  modePill: string;
}

export function modeLabels(mode: EngagementMode): ModeLabels {
  if (mode === 'readiness') {
    return {
      rightPaneTitle: 'Improvement Items',
      promoteAction: 'Add to Action Plan',
      promoteShort: 'Add',
      parkLabel: 'Park',
      modePill: 'Readiness Mode',
    };
  }
  return {
    rightPaneTitle: 'Candidate Findings',
    promoteAction: 'Promote to Finding',
    promoteShort: 'Add',
    parkLabel: 'Park',
    modePill: 'Audit Mode',
  };
}
