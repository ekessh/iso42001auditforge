// SPDX-License-Identifier: BUSL-1.1
/**
 * DEPRECATED for runtime data — kept only as an offline fallback for
 * Storybook stories, unit tests, and as the canonical TypeScript type
 * declarations the workspace components consume. Production hooks read
 * from `@auditforge/api-client` via TanStack Query.
 *
 * Mock fixtures for the v3 Conversational Audit Workspace. Mirrors the
 * data shape that the Conversational Audit Engine produces once Phase 7.6
 * lands; until then the api-client schema mirrors these types.
 */

export type EngagementMode = 'audit' | 'readiness';
export type AuditPhase =
  | 'Stage 1'
  | 'Stage 2'
  | 'Surveillance 1'
  | 'Surveillance 2'
  | 'Recertification'
  | 'Readiness';
export type CoverageStatus = 'evidenced' | 'partial' | 'contradicted' | 'untouched';
export type FindingType = 'major' | 'minor' | 'ofi' | 'observation';
export type Confidence = 'low' | 'medium' | 'high';
export type MessageType =
  | 'system_suggestion'
  | 'auditor_message'
  | 'auditee_answer'
  | 'inline_alert';
export type AlertKind = 'coverage_gap' | 'contradiction' | 'termination';

export interface ProvenanceLink {
  /** Stable id of the source (clause id, library question id, claim id). */
  id: string;
  /** Human-readable label, e.g. "A.7.4 Quality of data". */
  label: string;
  /** Optional href for navigation. */
  href?: string;
  /** Optional source kind for styling. */
  kind?: 'clause' | 'library' | 'claim' | 'profile';
}

export interface ReasoningTrace {
  /** Provider/model name (e.g., "Qwen 32B reasoning"). */
  model: string;
  /** Step-wise rationale lines, monospace render. */
  steps: string[];
}

export interface SystemSuggestionMessage {
  id: string;
  kind: 'system_suggestion';
  ts: string;
  /** Question text for "Accept & Ask". */
  body: string;
  /** Inline label, e.g. "System suggestion" or "Next suggestion (follow-up)". */
  label: string;
  provenance: ProvenanceLink[];
  rationale: string;
  reasoningTrace?: ReasoningTrace;
  modelBadge?: string;
}

export interface AuditorMessage {
  id: string;
  kind: 'auditor_message';
  ts: string;
  body: string;
  auditorName: string;
  intervieweeName: string;
  intervieweeRole?: string;
}

export interface AuditeeAnswerMessage {
  id: string;
  kind: 'auditee_answer';
  ts: string;
  body: string;
  speakerName: string;
  /** "typed" | "transcribed (whisper.cpp)" | "transcribed (cloud)" */
  source: 'typed' | 'transcribed_local' | 'transcribed_cloud';
}

export interface InlineAlertMessage {
  id: string;
  kind: 'inline_alert';
  ts: string;
  alertKind: AlertKind;
  what: string;
  /** Suggested follow-up question or remediation copy. */
  remediation?: string;
}

export type ConversationMessage =
  | SystemSuggestionMessage
  | AuditorMessage
  | AuditeeAnswerMessage
  | InlineAlertMessage;

export interface ClauseChip {
  /** Annex A.x.y or clause 4-10 identifier. */
  id: string;
  label: string;
}

export interface CandidateFinding {
  id: string;
  type: FindingType;
  /** Localised label for the type, e.g. "Major NC (candidate)". */
  typeLabel: string;
  statement: string;
  clauses: ClauseChip[];
  confidence: Confidence;
  /** "From answer at 14:21 by Dr. K. Ito · claim C-1421-04" */
  source: string;
  /** Linked claim ids (for traceability into Claims tab). */
  claimRefs: string[];
  parked: boolean;
}

export interface CoverageCell {
  /** Clause id e.g. "A.7.4". */
  id: string;
  /** Optional short title e.g. "Quality of data". */
  title?: string;
  status: CoverageStatus;
}

export interface CoverageArea {
  /** "A.7" */
  id: string;
  title: string;
  cells: CoverageCell[];
}

export interface ClaimEntry {
  id: string;
  ts: string;
  speakerName: string;
  body: string;
  /** Attribution: clauses, evidence handles, confidence. */
  clauseIds: string[];
  evidenceRefs?: string[];
  confidence: Confidence;
}

export interface WorkspaceContext {
  engagementId: string;
  clientName: string;
  scope: string;
  aiSystemInScope: string;
  phase: AuditPhase;
  area: string;
  mode: EngagementMode;
  sessionStartedAt: string;
  sessionDay: number;
  sessionTotalDays: number;
  coveragePct: number;
  workingPapersComplete: number;
  workingPapersTotal: number;
  candidateFindingsCount: number;
  manDaysSpent: number;
  manDaysPlanned: number;
  probesRun: number;
  llmTier: 'local' | 'cloud';
  llmModelLabel: string;
}

export interface WorkspaceMock {
  context: WorkspaceContext;
  messages: ConversationMessage[];
  candidateFindings: CandidateFinding[];
  coverageArea: CoverageArea;
  claims: ClaimEntry[];
}

const MOCK_AUDITOR = 'M. Castellanos';
const MOCK_DATA_LEAD = 'Dr. K. Ito';

export function buildWorkspaceMock(
  engagementId = 'eng-001',
  mode: EngagementMode = 'audit',
): WorkspaceMock {
  return {
    context: {
      engagementId,
      clientName: 'Atlas Diagnostics Inc.',
      scope:
        'AIMS — clinical decision support, radiology triage, drug-discovery RAG agents',
      aiSystemInScope: 'Radiology Triage Model v4.2 (RAG-class)',
      phase: 'Stage 2',
      area: 'A.7 Data',
      mode,
      sessionStartedAt: '2026-05-03T13:00:00Z',
      sessionDay: 3,
      sessionTotalDays: 5,
      coveragePct: 62,
      workingPapersComplete: 31,
      workingPapersTotal: 47,
      candidateFindingsCount: 7,
      manDaysSpent: 11,
      manDaysPlanned: 18,
      probesRun: 84,
      llmTier: 'local',
      llmModelLabel: 'Llama 3.1 8B / Qwen 32B',
    },
    messages: MOCK_MESSAGES,
    candidateFindings: MOCK_FINDINGS,
    coverageArea: MOCK_COVERAGE_AREA,
    claims: MOCK_CLAIMS,
  };
}

// -- Conversation ----------------------------------------------------------

const MOCK_MESSAGES: ConversationMessage[] = [
  {
    id: 'm-001',
    kind: 'system_suggestion',
    ts: '14:15',
    label: 'System suggestion',
    body: 'Walk me through how training-data lineage is recorded for the radiology triage model — from raw acquisition through versioned features into the deployed model.',
    rationale:
      'Coverage gap on A.6.2.7 (operation) combined with RAG-class profile, library template Q-A7-004 v3 prioritised based on 0.74 coverage-priority score.',
    provenance: [
      { id: 'A.7.4', label: 'A.7.4 Quality of data', kind: 'clause' },
      { id: 'Q-A7-004', label: 'Library Q-A7-004 v3', kind: 'library' },
      { id: 'A.6.2.7', label: 'A.6.2.7 operation', kind: 'clause' },
    ],
    modelBadge: 'Llama 3.1 8B (local)',
  },
  {
    id: 'm-002',
    kind: 'auditor_message',
    ts: '14:18',
    auditorName: MOCK_AUDITOR,
    intervieweeName: MOCK_DATA_LEAD,
    intervieweeRole: 'Data Lead',
    body: 'Walk me through how training-data lineage is recorded for the radiology triage model — from raw acquisition through versioned features into the deployed model.',
  },
  {
    id: 'm-003',
    kind: 'auditee_answer',
    ts: '14:21',
    speakerName: MOCK_DATA_LEAD,
    source: 'transcribed_local',
    body: 'We capture every cohort export with a hash and the DICOM source. The feature pipeline is in MLflow with run IDs pinned to model versions. We do not currently document retraining decisions in a written form — that gets discussed in the weekly review meeting and the meeting notes are stored in Confluence.',
  },
  {
    id: 'm-004',
    kind: 'inline_alert',
    ts: '14:21',
    alertKind: 'coverage_gap',
    what: 'Coverage gap detected — original question targeted A.6.2.7 (operation) but the answer did not address how lineage is verified at deployment.',
    remediation: 'Inject follow-up about deployment-time lineage verification.',
  },
  {
    id: 'm-005',
    kind: 'system_suggestion',
    ts: '14:22',
    label: 'Next suggestion (follow-up)',
    body: 'You mentioned retraining decisions are discussed in the weekly review and stored as meeting notes. Can you show me how those notes are referenced when a model version is approved for production?',
    rationale:
      'Follow-up question grounded in Claim C-1421-04 (admitted absence of written retraining records). Targets A.6.2.6 deployment governance gap.',
    provenance: [
      { id: 'C-1421-04', label: 'Claim C-1421-04', kind: 'claim' },
      { id: 'A.6.2.6', label: 'A.6.2.6 deployment governance', kind: 'clause' },
    ],
    reasoningTrace: {
      model: 'Qwen 32B (reasoning)',
      steps: [
        'Step 1 — Detected gap: deployment-link verification not addressed.',
        'Step 2 — Cross-checked C-1015-12 (MLOps Lead) which asserted documented retraining; potential contradiction with C-1421-04.',
        'Step 3 — Selected follow-up template Q-A6-006-FU-3 over Q-A6-006-FU-1 because it elicits artefact reference rather than restating the gap.',
        'Step 4 — Composed question, attached provenance, returned with priority 0.81.',
      ],
    },
    modelBadge: 'Qwen 32B (local, reasoning)',
  },
  {
    id: 'm-006',
    kind: 'auditee_answer',
    ts: '14:24',
    speakerName: MOCK_DATA_LEAD,
    source: 'typed',
    body: 'Honestly, the meeting notes are not currently linked from the deployment ticket. The MLOps lead approves the deploy in our tracker once tests pass; the retraining context lives separately in Confluence.',
  },
];

// -- Candidate findings ----------------------------------------------------

const MOCK_FINDINGS: CandidateFinding[] = [
  {
    id: 'cf-001',
    type: 'major',
    typeLabel: 'Major NC (candidate)',
    statement:
      'Possible contradiction: 10:15 interview with the MLOps Lead asserted retraining decisions are formally documented. 14:21 answer from the Data Lead asserts they are not. Engine raised a contradiction-resolution question.',
    clauses: [
      { id: 'A.6.2.6', label: 'A.6.2.6 Deployment' },
      { id: 'contradiction', label: 'Contradiction' },
    ],
    confidence: 'low',
    source: 'Cross-claim conflict · C-1015-12 vs C-1421-04',
    claimRefs: ['C-1015-12', 'C-1421-04'],
    parked: false,
  },
  {
    id: 'cf-002',
    type: 'minor',
    typeLabel: 'Minor NC',
    statement:
      'Retraining decisions for the radiology triage model are not documented in a written, version-pinned form. Discussions occur in a weekly review captured only in Confluence meeting notes.',
    clauses: [
      { id: 'A.6.2.6', label: 'A.6.2.6 Deployment' },
      { id: 'A.6.2.8', label: 'A.6.2.8 Operation' },
    ],
    confidence: 'high',
    source: 'From answer at 14:21 by Dr. K. Ito · claim C-1421-04',
    claimRefs: ['C-1421-04'],
    parked: false,
  },
  {
    id: 'cf-003',
    type: 'minor',
    typeLabel: 'Minor NC',
    statement:
      'Auditee asserts cohort hashes are captured but did not produce evidence of the SHA-256 register at the time of interview.',
    clauses: [{ id: 'A.7.4', label: 'A.7.4 Data quality' }],
    confidence: 'medium',
    source: 'Evidence absence — interview block 14:18–14:24',
    claimRefs: ['C-1421-02'],
    parked: false,
  },
  {
    id: 'cf-004',
    type: 'ofi',
    typeLabel: 'OFI',
    statement:
      'Pipeline lineage is well captured in MLflow but the link between cohort hash, feature run ID, and approved deployment is implicit. Recommend automated lineage-link generation for audit-trail clarity.',
    clauses: [{ id: 'A.7.4', label: 'A.7.4 Data quality' }],
    confidence: 'medium',
    source: 'From answer at 14:21 · claim C-1421-02',
    claimRefs: ['C-1421-02'],
    parked: false,
  },
  {
    id: 'cf-005',
    type: 'ofi',
    typeLabel: 'OFI',
    statement:
      'Consider a single-source-of-truth dashboard linking AI System Inventory entries to live MLflow run IDs to reduce manual reconciliation.',
    clauses: [{ id: 'A.6.2.5', label: 'A.6.2.5 Inventory' }],
    confidence: 'medium',
    source: 'From answer at 13:55 · claim C-1355-06',
    claimRefs: ['C-1355-06'],
    parked: false,
  },
  {
    id: 'cf-006',
    type: 'observation',
    typeLabel: 'Observation',
    statement:
      'Auditee mentioned an upcoming migration to a cloud-hosted feature store. Worth retaining for the next surveillance audit lineage check.',
    clauses: [{ id: 'A.7.6', label: 'A.7.6 Data preparation' }],
    confidence: 'high',
    source: 'From answer at 14:08 · claim C-1408-01',
    claimRefs: ['C-1408-01'],
    parked: true,
  },
];

// -- Coverage --------------------------------------------------------------

const MOCK_COVERAGE_AREA: CoverageArea = {
  id: 'A.7',
  title: 'A.7 Data for AI systems',
  cells: [
    { id: 'A.7.2', title: 'Data management process', status: 'evidenced' },
    { id: 'A.7.3', title: 'Data acquisition', status: 'evidenced' },
    { id: 'A.7.4', title: 'Quality of data for AI', status: 'partial' },
    { id: 'A.7.5', title: 'Data provenance', status: 'contradicted' },
    { id: 'A.7.6', title: 'Data preparation', status: 'untouched' },
    { id: 'A.7.7', title: 'Data labelling', status: 'untouched' },
  ],
};

// -- Claims ----------------------------------------------------------------

const CLAIMS_RAW: Array<Pick<ClaimEntry, 'speakerName' | 'body' | 'clauseIds' | 'confidence'>> = [
  { speakerName: 'Dr. K. Ito', body: 'Cohort exports include SHA-256 hashes paired to DICOM source IDs.', clauseIds: ['A.7.4'], confidence: 'high' },
  { speakerName: 'Dr. K. Ito', body: 'Feature pipeline orchestrated in MLflow; run IDs pinned to model versions.', clauseIds: ['A.7.4', 'A.6.2.6'], confidence: 'high' },
  { speakerName: 'Dr. K. Ito', body: 'Retraining decisions are discussed in the weekly review meeting; meeting notes stored in Confluence.', clauseIds: ['A.6.2.6'], confidence: 'high' },
  { speakerName: 'Dr. K. Ito', body: 'No written, version-pinned retraining record currently exists.', clauseIds: ['A.6.2.6', 'A.6.2.8'], confidence: 'high' },
  { speakerName: 'Dr. K. Ito', body: 'Deployment ticket does not link Confluence meeting notes.', clauseIds: ['A.6.2.6'], confidence: 'medium' },
  { speakerName: 'P. Nguyen (MLOps)', body: 'Retraining decisions are formally documented before deploy.', clauseIds: ['A.6.2.6'], confidence: 'medium' },
  { speakerName: 'P. Nguyen (MLOps)', body: 'Deploy gate enforced via release-management script v3.', clauseIds: ['A.6.2.6'], confidence: 'high' },
  { speakerName: 'P. Nguyen (MLOps)', body: 'Rollback procedure rehearsed monthly with on-call rotation.', clauseIds: ['A.6.2.8'], confidence: 'high' },
  { speakerName: 'A. Hartwell (CISO)', body: 'AI risk register reviewed quarterly by AIMS steering committee.', clauseIds: ['A.5.2'], confidence: 'high' },
  { speakerName: 'A. Hartwell (CISO)', body: 'Information security policies extended to cover model artefacts.', clauseIds: ['A.6.2.4'], confidence: 'high' },
  { speakerName: 'L. Park (Privacy)', body: 'DPIA performed for radiology triage model; reviewed annually.', clauseIds: ['A.5.4'], confidence: 'high' },
  { speakerName: 'L. Park (Privacy)', body: 'Data minimisation reviews tied to feature deprecation pipeline.', clauseIds: ['A.7.4'], confidence: 'medium' },
  { speakerName: 'Dr. K. Ito', body: 'Cohort balance metrics reviewed before retraining; no written threshold.', clauseIds: ['A.7.4'], confidence: 'medium' },
  { speakerName: 'Dr. K. Ito', body: 'Labelling workflow uses two-of-three radiologist consensus.', clauseIds: ['A.7.7'], confidence: 'medium' },
  { speakerName: 'Dr. K. Ito', body: 'Migration to cloud-hosted feature store planned for Q3.', clauseIds: ['A.7.6'], confidence: 'high' },
  { speakerName: 'P. Nguyen (MLOps)', body: 'Performance probes run weekly with drift thresholds.', clauseIds: ['A.6.2.8'], confidence: 'high' },
  { speakerName: 'P. Nguyen (MLOps)', body: 'Incident runbooks reviewed after every Sev-1 model incident.', clauseIds: ['A.6.2.8'], confidence: 'high' },
  { speakerName: 'A. Hartwell (CISO)', body: 'Third-party AI components inventoried with SBOM equivalents.', clauseIds: ['A.10.2'], confidence: 'medium' },
  { speakerName: 'L. Park (Privacy)', body: 'External users notified that an AI system is in use via consent UI.', clauseIds: ['A.9.2'], confidence: 'high' },
  { speakerName: 'L. Park (Privacy)', body: 'Right-to-explanation request workflow under design.', clauseIds: ['A.9.3'], confidence: 'low' },
];

const MOCK_CLAIMS: ClaimEntry[] = CLAIMS_RAW.map((c, i) => {
  const idx = i + 1;
  const padded = idx.toString().padStart(2, '0');
  return {
    id: `C-${1421 - i * 7}-${padded}`,
    ts: `14:${(24 - i).toString().padStart(2, '0')}`,
    ...c,
  };
});

// -- Readiness Dashboard mock -----------------------------------------------

export interface AnnexFamily {
  id: string;
  title: string;
  description: string;
  readinessPct: number;
  evidenced: number;
  partial: number;
  untouched: number;
  totalClauses: number;
  status: 'green' | 'amber' | 'red' | 'grey';
}

export interface ReadinessAiSystemBar {
  systemId: string;
  systemName: string;
  readinessPct: number;
  weight: number;
}

export interface BlockerItem {
  id: string;
  clauseId: string;
  clauseTitle: string;
  impact: 'high' | 'medium' | 'low';
  recommendedAction: string;
}

export interface OpenItem {
  id: string;
  type: FindingType;
  title: string;
  clauseId: string;
  age: string;
}

export interface ReadinessTrendPoint {
  date: string;
  readinessPct: number;
  event?: string;
}

export interface ReadinessMock {
  overallPct: number;
  trend30dDelta: number;
  trend90dDelta: number;
  targetCertDate: string;
  daysToTarget: number;
  families: AnnexFamily[];
  trend: ReadinessTrendPoint[];
  blockers: BlockerItem[];
  openItems: OpenItem[];
  aiSystems: ReadinessAiSystemBar[];
  weights: { mandatory: number; annexA: number; description: string };
}

export const MOCK_READINESS: ReadinessMock = {
  overallPct: 65,
  trend30dDelta: 7,
  trend90dDelta: 18,
  targetCertDate: '2026-09-15',
  daysToTarget: 135,
  families: [
    { id: 'A.2', title: 'A.2 Policies', description: 'AI policy framework', readinessPct: 92, evidenced: 4, partial: 0, untouched: 0, totalClauses: 4, status: 'green' },
    { id: 'A.3', title: 'A.3 Internal organisation', description: 'Roles & responsibilities', readinessPct: 88, evidenced: 6, partial: 1, untouched: 0, totalClauses: 7, status: 'green' },
    { id: 'A.4', title: 'A.4 Resources', description: 'Resource planning', readinessPct: 71, evidenced: 4, partial: 2, untouched: 0, totalClauses: 6, status: 'amber' },
    { id: 'A.5', title: 'A.5 Impact assessment', description: 'AI system impacts', readinessPct: 58, evidenced: 3, partial: 2, untouched: 1, totalClauses: 6, status: 'amber' },
    { id: 'A.6', title: 'A.6 AI lifecycle', description: 'Lifecycle controls', readinessPct: 49, evidenced: 5, partial: 4, untouched: 4, totalClauses: 13, status: 'amber' },
    { id: 'A.7', title: 'A.7 Data for AI', description: 'Data quality & lineage', readinessPct: 41, evidenced: 2, partial: 1, untouched: 3, totalClauses: 6, status: 'red' },
    { id: 'A.8', title: 'A.8 Information for stakeholders', description: 'Documentation', readinessPct: 67, evidenced: 3, partial: 2, untouched: 1, totalClauses: 6, status: 'amber' },
    { id: 'A.9', title: 'A.9 Use of AI systems', description: 'Operational use', readinessPct: 78, evidenced: 4, partial: 1, untouched: 0, totalClauses: 5, status: 'green' },
    { id: 'A.10', title: 'A.10 Third-party relationships', description: 'Supplier governance', readinessPct: 35, evidenced: 1, partial: 1, untouched: 3, totalClauses: 5, status: 'red' },
  ],
  trend: [
    { date: '2026-02-03', readinessPct: 47 },
    { date: '2026-02-17', readinessPct: 49 },
    { date: '2026-03-03', readinessPct: 51, event: 'A.2 policies signed' },
    { date: '2026-03-17', readinessPct: 53 },
    { date: '2026-03-31', readinessPct: 56 },
    { date: '2026-04-14', readinessPct: 58, event: 'CAPA closure batch' },
    { date: '2026-04-21', readinessPct: 60 },
    { date: '2026-04-28', readinessPct: 63 },
    { date: '2026-05-03', readinessPct: 65 },
  ],
  blockers: [
    { id: 'b-1', clauseId: 'A.7.5', clauseTitle: 'Data provenance', impact: 'high', recommendedAction: 'Resolve contradiction between MLOps and Data Lead claims; produce written lineage policy.' },
    { id: 'b-2', clauseId: 'A.6.2.6', clauseTitle: 'Deployment governance', impact: 'high', recommendedAction: 'Document retraining decision template and link from deploy tickets.' },
    { id: 'b-3', clauseId: 'A.10.2', clauseTitle: 'Third-party AI components', impact: 'high', recommendedAction: 'Complete SBOM-style inventory for vendor models; tie to AI System Inventory.' },
    { id: 'b-4', clauseId: 'A.5.2', clauseTitle: 'AI system impact assessment', impact: 'medium', recommendedAction: 'Refresh AI system impact assessments for radiology triage model.' },
    { id: 'b-5', clauseId: 'A.4.5', clauseTitle: 'Computational resources', impact: 'medium', recommendedAction: 'Approve sustainability budget tracker before next surveillance audit.' },
  ],
  openItems: [
    { id: 'oi-1', type: 'major', title: 'Possible contradiction on retraining documentation', clauseId: 'A.6.2.6', age: '2d' },
    { id: 'oi-2', type: 'minor', title: 'No written, version-pinned retraining record', clauseId: 'A.6.2.6', age: '2d' },
    { id: 'oi-3', type: 'minor', title: 'SHA-256 register evidence not produced', clauseId: 'A.7.4', age: '1d' },
    { id: 'oi-4', type: 'ofi', title: 'Implicit lineage link cohort→deploy', clauseId: 'A.7.4', age: '1d' },
    { id: 'oi-5', type: 'ofi', title: 'Single-source-of-truth dashboard suggestion', clauseId: 'A.6.2.5', age: '3d' },
    { id: 'oi-6', type: 'observation', title: 'Cloud feature store migration in Q3', clauseId: 'A.7.6', age: '1d' },
  ],
  aiSystems: [
    { systemId: 's-rad-triage', systemName: 'Radiology Triage Model v4.2', readinessPct: 71, weight: 0.4 },
    { systemId: 's-cds-llm', systemName: 'Clinical Decision Support LLM', readinessPct: 58, weight: 0.35 },
    { systemId: 's-rag-discovery', systemName: 'Drug Discovery RAG Agent', readinessPct: 39, weight: 0.25 },
  ],
  weights: {
    mandatory: 1.5,
    annexA: 1.0,
    description:
      'Σ(clause_weight × clause_status_score) / Σ(clause_weight). Status scores: evidenced=1.0, partial=0.5, contradicted=0.0, untouched=0.0. Mandatory clauses 4–10 weight 1.5; in-scope Annex A controls weight 1.0. Out-of-scope per SoA excluded.',
  },
};

// -- Audit Dashboard mock --------------------------------------------------

export interface AreaCoverageBar {
  areaId: string;
  areaTitle: string;
  planned: number;
  covered: number;
}

export interface ManDayPoint {
  day: number;
  planned: number;
  actual: number;
}

export type AuditRiskFlag = 'on_track' | 'coverage_gap' | 'time_overrun';

export interface AuditDashboardMock {
  coveragePct: number;
  areaBars: AreaCoverageBar[];
  manDays: ManDayPoint[];
  manDaysSpent: number;
  manDaysPlanned: number;
  candidateFindings: { major: number; minor: number; ofi: number; observation: number };
  promotedFindings: number;
  samplingCompletePct: number;
  risk: AuditRiskFlag;
  attentionAreas: Array<{ areaId: string; reason: string }>;
}

export const MOCK_AUDIT_DASHBOARD: AuditDashboardMock = {
  coveragePct: 62,
  areaBars: [
    { areaId: 'A.5', areaTitle: 'A.5 Impact assessment', planned: 6, covered: 5 },
    { areaId: 'A.6', areaTitle: 'A.6 AI lifecycle', planned: 13, covered: 8 },
    { areaId: 'A.7', areaTitle: 'A.7 Data for AI', planned: 6, covered: 3 },
    { areaId: 'A.8', areaTitle: 'A.8 Stakeholder info', planned: 6, covered: 4 },
    { areaId: 'A.9', areaTitle: 'A.9 Use of AI systems', planned: 5, covered: 4 },
    { areaId: 'A.10', areaTitle: 'A.10 Third-party', planned: 5, covered: 2 },
  ],
  manDays: [
    { day: 1, planned: 3.6, actual: 3.5 },
    { day: 2, planned: 7.2, actual: 7.1 },
    { day: 3, planned: 10.8, actual: 11 },
    { day: 4, planned: 14.4, actual: 11 },
    { day: 5, planned: 18, actual: 11 },
  ],
  manDaysSpent: 11,
  manDaysPlanned: 18,
  candidateFindings: { major: 1, minor: 4, ofi: 7, observation: 2 },
  promotedFindings: 3,
  samplingCompletePct: 64,
  risk: 'coverage_gap',
  attentionAreas: [
    { areaId: 'A.7', reason: 'Coverage 50%; one contradiction unresolved on A.7.5.' },
    { areaId: 'A.10', reason: 'Coverage 40%; third-party register incomplete.' },
  ],
};
