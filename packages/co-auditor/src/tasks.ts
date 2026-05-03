// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const QuestionSuggestion = z.object({
  questions: z.array(z.object({
    text: z.string().min(5),
    intent: z.string().min(5),
    mappedClauses: z.array(z.string()).default([]),
  })).min(1).max(20),
});
export type QuestionSuggestion = z.infer<typeof QuestionSuggestion>;

export const GapDetection = z.object({
  gaps: z.array(z.object({
    clauseId: z.string(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  })).default([]),
});
export type GapDetection = z.infer<typeof GapDetection>;

export const NcDraft = z.object({
  clauseRef: z.string(),
  requirementSummary: z.string(),
  evidenceRefs: z.array(z.string()),
  statement: z.string().min(10),
  suggestedSeverity: z.enum(['minor', 'major']),
});
export type NcDraft = z.infer<typeof NcDraft>;

export const ReportRewrite = z.object({
  before: z.string(),
  after: z.string(),
  changes: z.array(z.object({ kind: z.enum(['clarity', 'tone', 'concision']), note: z.string() })).default([]),
});
export type ReportRewrite = z.infer<typeof ReportRewrite>;

export const ProbeSelection = z.object({
  selected: z.array(z.object({ probeId: z.string(), rationale: z.string() })).min(1),
});
export type ProbeSelection = z.infer<typeof ProbeSelection>;

export const TraceSummary = z.object({
  summary: z.string().min(10),
  riskHighlights: z.array(z.string()).default([]),
});
export type TraceSummary = z.infer<typeof TraceSummary>;

export const TASK_PARSERS = {
  suggest_questions: (r: unknown) => QuestionSuggestion.parse(r),
  detect_gaps: (r: unknown) => GapDetection.parse(r),
  draft_nc: (r: unknown) => NcDraft.parse(r),
  rewrite_section: (r: unknown) => ReportRewrite.parse(r),
  select_probes: (r: unknown) => ProbeSelection.parse(r),
  summarize_trace: (r: unknown) => TraceSummary.parse(r),
} as const;
